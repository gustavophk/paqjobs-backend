//importando groq
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.KEY_GROQ });
const Vaga = require('../db/vaga.schema');
const {tools} = require('../services/tools.service');

const formatVagas = (vagas) => vagas.map(vaga => ({
    IdVaga: vaga.id_vaga_external ?? vaga._id ?? null,
    nomeVaga: vaga.title || vaga.name || '',
    descricaoVaga: vaga.description || ''
}));

//metodo para tentar extrair um array json valido de uma string de resposta da IA
const tryParseJsonArray = (text) => {
    //verifica se o texto é uma string válida, se não for retorna null
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    //tenta parsear um texto em json
    const parseCandidate = (candidate) => {
        try {
            const parsed = JSON.parse(candidate);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === 'object') {
                if (Array.isArray(parsed.vagas)) return parsed.vagas;
                if (Array.isArray(parsed.data)) return parsed.data;
                if (Array.isArray(parsed.results)) return parsed.results;
            }
        } catch (_) {
            return null;
        }
        return null;
    };
    //primeiro tenta parsear a string inteira
    const direct = parseCandidate(trimmed);
    if (direct) return direct;
    //depois tenta encontrar apenas o bloco json entre []
    const jsonMatch = trimmed.match(/\[.*\]/s);
    if (jsonMatch) {
        return parseCandidate(jsonMatch[0]);
    }

    return null;
};

const converse = async (req, res) => {
    try {
        if (!process.env.KEY_GROQ) {
            console.error('KEY_GROQ não está configurada');
            return res.status(500).json({ erro: 'Não foi possível falar com a IA. KEY_GROQ não está configurada.' });
        }

        const userMessage = req.body?.mensagem || req.body?.input || "Diga um oi genérico";
        const mensagens = [
            {
                role:"system",
                content: `Você é um assistente virtual especializado em ajudar pessoas a encontrar vagas de estágio e jovem aprendiz. 
                Sempre que o usuário perguntar sobre vagas disponíveis, empregos ou oportunidades na área de tecnologia, 
                você deve usar a ferramenta 'buscar_vagas_no_banco' para buscar as vagas disponíveis no banco de dados e fornecer as informações relevantes ao usuário. 
                O banco de dados é sua única fonte de verdade. Nunca invente, crie ou presuma vagas que não foram retornadas pela ferramenta.
                Quando retornar a resposta final ao frontend, entregue apenas um JSON array com objetos de vaga, sem texto adicional. 
                Cada objeto deve conter os campos IdVaga, nomeVaga e descricaoVaga. 
                Se não houver vagas, retorne uma lista JSON vazia: [].` 
            },
            {
                role:"user",
                content: userMessage,
            }
        ];

        // Fazendo a inicialização da chamada de ferramentas, passando a função que criamos para buscar vagas no banco
        const chatCompletion = await groq.chat.completions.create({
            messages: mensagens,
            model: "llama-3.3-70b-versatile",
            tools: tools,
            tool_choice: "auto",//modelo utilizara a ferramenta somente quando determinar que elas sao necessarias para a consulta
        });

        //Pegamos a primeira escolha e extraímos a mensagem da IA.
        const firstChoice = chatCompletion.choices?.[0];
        const responseMessage = firstChoice?.message;
        const respostaDaIA = responseMessage?.message ?? responseMessage;

        //Interceptar funções vazadas pela IA
        if (respostaDaIA.content && respostaDaIA.content.includes('<function')) {
            // Procura pelo padrão que a IA imprimiu na tela
            const regexFerramenta = /<function[\(=]?([a-zA-Z0-9_]+)[\)>]?({.*?})<\/function>/s;
            const match = respostaDaIA.content.match(regexFerramenta);
            
            if (match) {
                console.log(" Interceptamos uma função vazada:", match[1]);
                // Forçamos a estrutura correta que o nosso código entende
                respostaDaIA.tool_calls = [{
                    id: 'call_fallback_' + Date.now(),
                    type: 'function',
                    function: {
                        name: match[1], // Pega o nome: buscar_vagas_no_banco
                        arguments: match[2] // Pega o JSON: {"cargo": "estágio"}
                    }
                }];
                respostaDaIA.content = ""; // Limpa o texto sujo para não aparecer no chat
            }
        }
        // --- FIM DO INTERCEPTADOR ---
        if (!respostaDaIA) {
            console.error('Resposta inesperada da IA:', chatCompletion);
            return res.status(500).json({ erro: 'Resposta inválida da IA.' });
        }

        //a IA quer usar a ferramenta?
        if (respostaDaIA.tool_calls && respostaDaIA.tool_calls.length) {
            const toolCall = respostaDaIA.tool_calls[0];
            const argumentosDaIA = typeof toolCall.function.arguments === 'string'
                ? JSON.parse(toolCall.function.arguments)
                : (toolCall.function.arguments || {});

            // Buscamos no MongoDB limitando a apenas 5 resultados
            const vagasDoBanco = await Vaga.find({
                $or: [
                    { title: new RegExp(termoBusca, 'i') },
                    { name: new RegExp(termoBusca, 'i') },
                    { description: new RegExp(termoBusca, 'i') }
                ]
            }).limit(5); // Limite adicionado

            // Encurtamos a descrição para economizar tokens do Groq
            const vagasEnxutas = vagasDoBanco.map(vaga => ({
                IdVaga: vaga.id_vaga_external || vaga._id || null,
                nomeVaga: vaga.title || vaga.name || '',
                descricaoVaga: vaga.description ? vaga.description.substring(0, 150) + '...' : ''
            }));

            mensagens.push(respostaDaIA);
            
            // Devolvemos para a IA apenas as vagas reduzidas
            mensagens.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: JSON.stringify(vagasEnxutas) 
            });

            //A IA processa a resposta da ferramenta e gera uma resposta final para o usuário
            const respostaFinal = await groq.chat.completions.create({
                messages: mensagens,
                model: 'llama-3.3-70b-versatile',
            });

            const finalMessage = respostaFinal.choices?.[0]?.message?.content
                ?? respostaFinal.choices?.[0]?.message;
            const parsedJson = tryParseJsonArray(finalMessage);
            if (parsedJson) {
                return res.status(200).json(parsedJson);
            }

            return res.status(200).json(formatVagas(vagasDoBanco));
        }

        //Devolvemos para o Postman parar de carregar
        const reply = respostaDaIA.content ?? respostaDaIA.text ?? respostaDaIA;
        res.status(200).json({ resposta: reply });

    } catch (error) {
        console.error("Erro na API do Groq:", error);
        if (error?.response) {
            console.error('Resposta da API Groq:', error.response);
        }

        let mensagemErro = null;
        if (typeof error === 'string') {
            mensagemErro = error;
        } else if (error?.message) {
            mensagemErro = error.message;
        } else if (error?.response?.statusText) {
            mensagemErro = error.response.statusText;
        } else {
            try {
                mensagemErro = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
            } catch (jsonError) {
                mensagemErro = 'Erro desconhecido sem mensagem';
            }
        }

        res.status(500).json({ erro: `Falha na IA: ${mensagemErro}` });
    }
}

module.exports = {
    converse
};