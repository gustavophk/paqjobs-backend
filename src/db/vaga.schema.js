const mongoose = require('mongoose');

//schema usando mongoose
const vagaSchema = new mongoose.Schema({
  name: {type:String, required: true},
  _id: {type: Number, required: true},
  id_vaga_external: {type: Number},
  title: {type: String, required: true},//required é obrigatorio
  description: {type: String},
  location: {type: String},
  redirect_url: {type: String, unique: true},
  company: {type: String}
}, {
  timestamps: true // cria automaticamente a data de criacao e atualizacao 
});

const Vaga = mongoose.model('Vaga', vagaSchema);
//exportar o modelo para poder usar em outros arquivos
module.exports = Vaga;