//importanto modelo 

//Função reutilizavel de salvar/atualizar vaga de acordo com o id da vaga
const Vaga = require('../db/vaga.schema');
async function registrarVaga(dadosVaga){
  try{
    //usar o findOneAndUpdate com upsert:true
    //Tenta achar a url. se achar, ele atualiza. se nao achar, ele cria.
    //isso garante que nao teremos duplicados no banco de dados.
    const resultado = await Vaga.findOneAndUpdate(
      {id_vaga_external: dadosVaga.id_vaga_external}, //criterio de busca
      dadosVaga,            //dados para inserir/alterar
      {upsert: true, new: true, runValidators: true}
    );
    return resultado;
  } catch(error){
    console.error("Erro na persistencia da vaga: ", error);
    throw error;
  }
}

module.exports = { registrarVaga };//exportar a função