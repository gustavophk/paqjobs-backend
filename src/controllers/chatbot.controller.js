//controller do chatbot

//importando groq
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.KEY_GROQ });
const Vaga = require('../db/vaga.schema');
const {tools} = require('../services/tools.service');

//metodo para formatar as vagas em um array de objetos com campos específicos
const formatVagas = (vagas) => vagas.map(vaga => ({
    IdVaga: vaga.id_vaga_external ?? vaga._id ?? null,
    nomeVaga: vaga.title || vaga.name || '',
    descricaoVaga: vaga.description || ''
}));

//metodo para formatar as vagas em HTML com classes do Tailwind CSS
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

const stripAccents = (text = '') => {
    return text
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
};

const normalizeText = (text = '') => {
    return stripAccents(text).toLowerCase().trim();
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
                content: `Você é um assistente virtual especializado em conectar pessoas a vagas de estágio e jovem aprendiz na área de tecnologia. 

## COMPORTAMENTO GERAL E COMPREENSÃO
1. Você deve ser amigável, prestativo e focado em carreiras de tecnologia. Se o usuário apenas saudar ("Olá", "Tudo bem?"), responda cordialmente e se coloque à disposição para ajudar a encontrar vagas.
2. Tolerância a acentuação: O usuário pode digitar de forma informal, sem acentos ou pontuação (ex: "estagio", "programacao", "junior"). Interprete essas palavras ou outras com o mesmo peso e significado de suas versões gramaticalmente corretas.
3. Contexto Padrão (Foco em Tecnologia): Se o usuário pedir vagas de forma genérica, sem especificar a área (ex: "Quero vagas de estagiário", "Tem vaga de jovem aprendiz?"), ASSUMA implicitamente que ele está buscando vagas na área de Tecnologia, TI ou Programação. Ao usar a ferramenta de busca, aplique esse filtro tecnológico.

## REGRAS DE USO DA FERRAMENTA
1. Sempre que o usuário perguntar sobre vagas, empregos, oportunidades ou pedir indicações de carreira, você DEVE utilizar a ferramenta 'buscar_vagas_no_banco'.
2. O banco de dados é sua ÚNICA fonte de informação para vagas reais. NUNCA invente, crie ou presuma vagas que não foram retornadas pela ferramenta.

## REGRAS DE FORMATAÇÃO (EXCLUSIVO PARA QUANDO RETORNAR VAGAS)
Se a ferramenta for acionada e retornar vagas, sua resposta deve conter APENAS o código HTML válido com as vagas encontradas, utilizando classes utilitárias do Tailwind CSS, sem saudações ou explicações textuais fora do HTML.

- Envolva as vagas em uma lista <ul class="flex flex-col gap-4">.
- Cada vaga deve ser um <li>.
- Mostre o nomeVag em um título: <h3 class="text-xl font-semibold text-gray-800">.
- Mostre a descricaoVaga em um parágrafo: <p class="mt-2 text-gray-600">.
- *REGRA CRÍTICA PARA LINKS:* O botão/link para a vaga DEVE OBRIGATORIAMENTE seguir esta estrutura, substituindo {IdVaga} pelo ID real:
  <a href="/vagas/{IdVaga}" class="chat-vaga-link">Ver Vaga</a>

## SE NENHUMA VAGA FOR ENCONTRADA
Se o usuário pediu por vagas, a ferramenta foi executada, mas o banco de dados retornou vazio, responda estritamente com: <div></div>`
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

            const escapeRegex = (text = '') => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const buildSearchTerms = (raw = '') => {
                const normalized = normalizeText(raw);
                const terms = new Set();
                if (normalized) {
                    terms.add(normalized);
                    terms.add(stripAccents(normalized));
                }
                const vacancySynonyms = ['estágio', 'estagio', 'estagiário', 'estagiario', 'jovem aprendiz', 'aprendiz', 'vaga', 'vagas', 'emprego', 'oportunidade', 'trainee'];
                vacancySynonyms.forEach((term) => {
                    if (!normalized || normalized.includes(normalizeText(term))) {
                        terms.add(term);
                    }
                });
                return Array.from(terms).filter(Boolean);
            };

            const searchVagasNoBanco = async (rawSearchText = '') => {
                const searchTerms = buildSearchTerms(rawSearchText);
                const regexes = searchTerms.map(term => new RegExp(escapeRegex(term), 'i'));
                return await Vaga.find({
                    $or: [
                        ...regexes.map(regex => ({ title: regex })),
                        ...regexes.map(regex => ({ name: regex })),
                        ...regexes.map(regex => ({ description: regex })),
                    ]
                }).limit(5);
            };

            const termoBusca = argumentosDaIA.cargo || '';
            const vagasDoBanco = await searchVagasNoBanco(termoBusca || userMessage);

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
                
                // formata cada vaga
                vagasParaMostrar.forEach(vaga => {
                    textoAmigavel += `🔹 <b>${vaga.nomeVaga}</b>\n${vaga.descricaoVaga}<br><br>`;
                });

                // Devolve no formato exato que o Front-end espera: { resposta: "texto" }
                return res.status(200).json({ resposta: textoAmigavel });
            } else {
                return res.status(200).json({ resposta: "Poxa, não encontrei nenhuma vaga com esses requisitos no momento." });
            }
        }
        const reply = typeof respostaDaIA === 'string'
            ? respostaDaIA
            : (respostaDaIA.content ?? respostaDaIA.text ?? '');

        const normalizedReply = reply.toString().trim();
        const normalizedUserMessage = normalizeText(userMessage);
        const userAskedVagas = ['vaga', 'vagas', 'estagio', 'estágio', 'estagiario', 'estagiário', 'jovem aprendiz', 'aprendiz', 'emprego', 'oportunidade']
            .some(keyword => normalizedUserMessage.includes(normalizeText(keyword)));

        if (!normalizedReply && userAskedVagas) {
            const escapeRegex = (text = '') => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const buildSearchTerms = (raw = '') => {
                const normalized = normalizeText(raw);
                const terms = new Set();
                if (normalized) {
                    terms.add(normalized);
                    terms.add(stripAccents(normalized));
                }
                const vacancySynonyms = ['estágio', 'estagio', 'estagiário', 'estagiario', 'jovem aprendiz', 'aprendiz', 'vaga', 'vagas', 'emprego', 'oportunidade', 'trainee'];
                vacancySynonyms.forEach((term) => {
                    if (!normalized || normalized.includes(normalizeText(term))) {
                        terms.add(term);
                    }
                });
                return Array.from(terms).filter(Boolean);
            };
            const searchVagasNoBancoFallback = async (rawSearchText = '') => {
                const searchTerms = buildSearchTerms(rawSearchText);
                const regexes = searchTerms.map(term => new RegExp(escapeRegex(term), 'i'));
                return await Vaga.find({
                    $or: [
                        ...regexes.map(regex => ({ title: regex })),
                        ...regexes.map(regex => ({ name: regex })),
                        ...regexes.map(regex => ({ description: regex })),
                    ]
                }).limit(5);
            };

            const vagasDoBanco = await searchVagasNoBancoFallback(userMessage);
            if (vagasDoBanco && vagasDoBanco.length > 0) {
                let textoAmigavel = 'Aqui estão as vagas que encontrei para você:\n\n';
                vagasDoBanco.forEach(vaga => {
                    textoAmigavel += `🔹 <b>${vaga.title || vaga.name || ''}</b>\n${vaga.description || ''}<br><br>`;
                });
                return res.status(200).json({ resposta: textoAmigavel });
            }

            return res.status(200).json({ resposta: 'Poxa, não encontrei nenhuma vaga com esses requisitos no momento.' });
        }

        res.status(200).json({ resposta: reply || 'Desculpe, não consegui entender sua solicitação.' });     

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

