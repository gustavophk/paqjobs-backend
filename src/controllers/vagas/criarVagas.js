const {registrarVaga} = require('../../services/vaga.service');

// metodo criar-vagas post para adicionar uma vaga no banco de dados mongoDB
const criarVagas = async (req, res) =>{
  try{
    //Pegar dados que o cliente enviou
    const vaga = await registrarVaga(req.body);
    //Devolver uma resposta de sucesso com ID que o MongoDB gerou
    res.status(201).json({
      mensagem: "Vaga criada com sucesso!",
      id: vaga._id
    });
  } catch(error) {
    console.error("Erro ao criar vaga: ", error);
    res.status(500).json({mensagem: "Erro interno ao criar a vaga"});
  }
};

module.exports = {
    criarVagas
}; 
