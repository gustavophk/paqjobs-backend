const Pessoa = require('../../db/pessoa.schema');

const getPessoaPorId = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ mensagem: 'Id inválido' });
    }

    const pessoa = await Pessoa.findById(id);
    if (!pessoa) {
      return res.status(404).json({ mensagem: 'Pessoa não encontrada' });
    }

    res.status(200).json(pessoa);
  } catch (error) {
    console.error('Erro ao buscar pessoa por id: ', error);
    res.status(500).json({ mensagem: 'Erro interno ao buscar pessoa' });
  }
};

module.exports = getPessoaPorId; 
