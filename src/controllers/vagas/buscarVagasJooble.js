const axios = require('axios');

// metodo http para buscar vagas api jooble
const buscarVagasJooble = async (req, res) => {
  try{
    const urlJooble = process.env.URL_JOOBLE;
    //filtros para buscar
    const filtrosBuscas = {
      "keywords": "junior OR trainee OR estágio OR estagiário OR intern OR \"entry level\"",
      "location": "Brazil"
    }
    // O servidor faz um POST para o jooble usando biblioteca axios
    //eh enviado a url e depois os filtros de busca
    const respostaDojooble = await axios.post(urlJooble, filtrosBuscas);
    //pegar resposta da api jooble e repassar a mensagem
    res.status(200).json(respostaDojooble.data);
  } catch(error){
    console.error("Erro ao buscar no jooble: ", error);
    res.status(500).json({mensagem: "Deu ruim na busca com o Jooble"});
  }
};

module.exports = {
    buscarVagasJooble
};