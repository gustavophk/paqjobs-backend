const Pessoa = require('../../db/pessoa.schema');

const atualizarPessoa = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ mensagem: 'Id inválido' });
    }

    const { name, email, password, date_birth, bio } = req.body;
    const dadosAtualizados = {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(password !== undefined && { password }),
      ...(date_birth !== undefined && { date_birth: date_birth ? new Date(date_birth) : null }),
      ...(bio !== undefined && { bio })
    };

    const pessoaAtualizada = await Pessoa.findByIdAndUpdate(id, dadosAtualizados, {
      new: true,
      runValidators: true
    });

    if (!pessoaAtualizada) {
      return res.status(404).json({ mensagem: 'Pessoa não encontrada' });
    }

    res.status(200).json(pessoaAtualizada);
  } catch (error) {
    console.error('Erro ao atualizar pessoa: ', error);
    res.status(500).json({ mensagem: 'Erro interno ao atualizar pessoa' });
  }
};

module.exports = atualizarPessoa; 

