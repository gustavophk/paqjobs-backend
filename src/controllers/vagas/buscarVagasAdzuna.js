const axios = require('axios');
const {registrarVaga} = require('../../services/vaga.service');

// metodo http get para buscar vagas da api adzuna
const buscarVagasAdzuna = async (req, res) => {
  try{
    //variavel para dados da adzuna utilizando .env
    const urlAdzuna = process.env.URL_ADZUNA;
    //Servidor vai para Adzuna e busca dados
    const resposta = await axios.get(urlAdzuna);
    const vagasExternas = resposta.data.results;

    //A REPENSAR
    //Mapeamento de adzuna para o MongoDB
    const promessasDeRegistro = vagasExternas.map(vaga => {
      const vagaFormatada = {
        name: vaga.title || "Sem nome",
        id_vaga_external: vaga.id,
        title: vaga.title,//required é obrigatorio
        description: vaga.description,
        location: vaga.location?.display_name || "Remoto / Não informado",
        redirect_url: vaga.redirect_url,
        company: vaga.company?.display_name || "Empresa Confidencial"//display name foi pq na hora de dar o post está vindo como objeto, ai pega somente o texto
      };
      //Salva no banco usando a função registrar vaga
      return registrarVaga(vagaFormatada);
    });

    //aguarda todos os registros serem processados
    await Promise.all(promessasDeRegistro);
    //Repassar os resultados direto para quem pediu
    res.status(200).json({mensagem: `${vagasExternas.length} vagas da adzuna foram processadas e sincronizadas. `});
  }catch(error) {
    console.error("ERRO ADZUNA:", error);
    res.status(500).json({erro: "Falha ao buscar vagas no Adzuna", detalhe: error.message});
  }
};

module.exports = {
    buscarVagasAdzuna
};