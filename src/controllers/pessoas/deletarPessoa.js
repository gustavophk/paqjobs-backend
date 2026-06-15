const Pessoa = require('../../db/pessoa.schema');

const deletarPessoa = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ mensagem: 'Id inválido' });
    }

    const pessoaRemovida = await Pessoa.findByIdAndDelete(id);
    if (!pessoaRemovida) {
      return res.status(404).json({ mensagem: 'Pessoa não encontrada' });
    }

    res.status(200).json({ mensagem: 'Pessoa removida com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar pessoa: ', error);
    res.status(500).json({ mensagem: 'Erro interno ao deletar pessoa' });
  }
};

module.exports = deletarPessoa; 
