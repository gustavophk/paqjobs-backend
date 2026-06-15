//controller do chatbot

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

const formatVagasHTML = (vagas) => {
    if (!Array.isArray(vagas) || vagas.length === 0) return '<div></div>';
    const items = vagas.map(v => {
        const id = v.IdVaga ?? '';
        const nome = (v.nomeVaga || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const desc = (v.descricaoVaga || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<li><h3>${nome}</h3><p>${desc}</p><small>ID: ${id}</small></li>`;
    }).join('');
    return `<ul>${items}</ul>`;
};

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
                Quando retornar a resposta final ao frontend, entregue HTML formatado contendo a lista de vagas (por exemplo, uma lista <ul><li>). 
                Cada vaga deve apresentar os campos IdVaga, nomeVaga e descricaoVaga dentro das tags HTML apropriadas.
                Se não houver vagas, retorne um HTML vazio (por exemplo, <div></div>).` 
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
            functions: tools,
            function_call: "auto",
        });

        // Pegamos a primeira escolha e extraímos a mensagem da IA.
        const firstChoice = chatCompletion.choices?.[0];
        const responseMessage = firstChoice?.message;
        const respostaDaIA = responseMessage ?? firstChoice;

        // Normaliza respostas de function_call do Groq/OpenAI para o formato esperado.
        if (responseMessage?.function_call) {
            respostaDaIA.tool_calls = [{
                id: 'call_auto_' + Date.now(),
                type: 'function',
                function: {
                    name: responseMessage.function_call.name,
                    arguments: responseMessage.function_call.arguments || '{}'
                }
            }];
        }

        // Interceptar funções vazadas pela IA em texto, se houver.
        if (respostaDaIA.content && respostaDaIA.content.includes('<function')) {
            const regexFerramenta = /<function[\(=]?([a-zA-Z0-9_]+)[\)>]?({.*?})<\/function>/s;
            const match = respostaDaIA.content.match(regexFerramenta);
            
            if (match) {
                console.log("Interceptamos uma função vazada:", match[1]);
                respostaDaIA.tool_calls = [{
                    id: 'call_fallback_' + Date.now(),
                    type: 'function',
                    function: {
                        name: match[1],
                        arguments: match[2]
                    }
                }];
                respostaDaIA.content = "";
            }
        }

        if (!respostaDaIA) {
            console.error('Resposta inesperada da IA:', chatCompletion);
            return res.status(500).json({ erro: 'Resposta inválida da IA.' });
        }

        // a IA quer usar a ferramenta?
        if (respostaDaIA.tool_calls && respostaDaIA.tool_calls.length) {
            const toolCall = respostaDaIA.tool_calls[0];
            const argumentosDaIA = typeof toolCall.function.arguments === 'string'
                ? JSON.parse(toolCall.function.arguments)
                : (toolCall.function.arguments || {});

            const termoBusca = argumentosDaIA.cargo || '';

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
            
            // Devolvemos para a IA apenas as vagas reduzidas (em HTML formatado)
            mensagens.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: toolCall.function.name,
                content: formatVagasHTML(vagasEnxutas)
            });

            
            //A IA processa a resposta da ferramenta e gera uma resposta final para o usuário
            const respostaFinal = await groq.chat.completions.create({
                messages: mensagens,
                model: 'llama-3.3-70b-versatile',
            });

            const finalMessage = respostaFinal.choices?.[0]?.message?.content
                ?? respostaFinal.choices?.[0]?.message;

            // Se a IA retornou HTML (começa com <), devolvemos diretamente
            if (typeof finalMessage === 'string' && finalMessage.trim().startsWith('<')) {
                return res.status(200).json({ resposta: finalMessage });
            }

            const parsedJson = tryParseJsonArray(finalMessage);
            const vagasParaMostrar = parsedJson || formatVagas(vagasDoBanco);

            console.log(finalMessage);
            console.log(vagasDoBanco);
            if (vagasParaMostrar && vagasParaMostrar.length > 0) {
                // Monta um texto bonito com as vagas para o Front-end ler sem quebrar
                let textoAmigavel = "Aqui estão as vagas que encontrei para você:\n\n";
                
                vagasParaMostrar.forEach(vaga => {
                    textoAmigavel += `🔹 **${vaga.nomeVaga}**\n${vaga.descricaoVaga}\n\n`;
                });

                // Devolve no formato exato que o Front-end espera: { resposta: "texto" }
                return res.status(200).json({ resposta: textoAmigavel });
            } else {
                return res.status(200).json({ resposta: "Poxa, não encontrei nenhuma vaga com esses requisitos no momento." });
            }
        }
        // Devolvemos para o front-end parar de carregar caso a IA não tenha usado nenhuma ferramenta
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

