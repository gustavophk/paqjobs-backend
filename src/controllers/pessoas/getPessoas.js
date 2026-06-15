const Pessoa = require('../../db/pessoa.schema');

const getPessoas = async (req, res) => {
  try {
    const pessoas = await Pessoa.find({});
    res.status(200).json(pessoas);
  } catch (error) {
    console.error('Erro ao buscar pessoas: ', error);
    res.status(500).json({ mensagem: 'Erro interno ao buscar pessoas' });
  }
};

module.exports = getPessoas; 
