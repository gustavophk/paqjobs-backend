//criando ferramenta para buscar vagas no banco de dados

const tools = [
    {
        name: "buscar_vagas_no_banco",
        description: `Buscando vagas de estagio ou jovem aprendiz no banco de dados. 
            Usar essa tool sempre que o usuário perguntar sobre vagas disponiveis, empregos ou oportunidades.`,
        parameters: {
            type: "object",
            properties: {
                cargo: {
                    type: "string",
                    description: "A tecnologia ou nome do cargo que o usuário está interessado. Exemplo: 'estágio em desenvolvimento web', 'vaga jovem aprendiz', 'python', front-end', 'back-end', se o usuário não especificar, deixar em branco."
                }
            },
            required: ["cargo"]
        }
    }
];

module.exports = {
    tools
};