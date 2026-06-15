const Pessoa = require('../../db/pessoa.schema');

const criarPessoa = async (req, res) => {
  try {
    const { _id, name, email, password, date_birth, bio } = req.body;

    if (_id === undefined || name === undefined || email === undefined || password === undefined) {
      return res.status(400).json({ mensagem: 'Os campos _id, name, email e password são obrigatórios' });
    }

    const novaPessoa = new Pessoa({
      _id: Number(_id),
      name,
      email,
      password,
      date_birth: date_birth ? new Date(date_birth) : undefined,
      bio
    });

    await novaPessoa.save();
    res.status(201).json(novaPessoa);
  } catch (error) {
    console.error('Erro ao criar pessoa: ', error);
    res.status(500).json({ mensagem: 'Erro interno ao criar pessoa' });
  }
};

module.exports = criarPessoa; 

