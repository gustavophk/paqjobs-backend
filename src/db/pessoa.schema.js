const mongoose = require('mongoose');

const pessoaSchema = new mongoose.Schema({
  _id: { type: Number, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  date_birth: { type: Date },
  bio: { type: String }
}, {
  timestamps: true // cria automaticamente a data de criacao e atualizacao 
});

const Pessoa = mongoose.model('Pessoa', pessoaSchema);
//exportar o modelo para ser usado em outros arquivos
module.exports = Pessoa;
