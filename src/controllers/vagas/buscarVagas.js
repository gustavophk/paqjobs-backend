const Vaga = require('../../db/vaga.schema');

//buscar vagas no banco
const buscarVagas = async (req, res) =>{
  try{
    const search = req.query.search || req.query.q || '';

    const filtro = search
      ? {
          $or: [
            { title: new RegExp(search, 'i') },
            { name: new RegExp(search, 'i') },
            { description: new RegExp(search, 'i') }
          ]
        }
      : {};

    // Vaga find vai direto na coleção certa
    const listaDeVagas = await Vaga.find(filtro);
    // devolve a lista de vagas com o status 200 (ok)
    res.status(200).json(listaDeVagas);
  } catch (error){ // caso aconteça algum erro o servidor nao crasha e desliga, ele vai capturar o erro e avisar o cliente
    console.error("Erro ao buscar as vagas: ", error);
    // se der o erro avisa quem fez a requisição
    res.status(500).json({ mensagem: "Erro interno ao buscar vagas" });
  }
};

module.exports = {
    buscarVagas
};