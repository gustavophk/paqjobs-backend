const Vaga = require('../../db/vaga.schema');

// metodo buscar uma vaga especifica pelo id recebido na rota
const buscarVagasPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const idNumerico = Number(id);

    const vaga = await Vaga.findOne({
      $or: [
        { _id: id },
        { _id: Number.isNaN(idNumerico) ? undefined : idNumerico },
        { id_vaga_external: Number.isNaN(idNumerico) ? undefined : idNumerico },
        { id_vaga_external: id },
      ].filter(Boolean),
    });

    if (!vaga) {
      return res.status(404).json({ mensagem: 'Vaga não encontrada' });
    }

    res.status(200).json(vaga);
  } catch (error) {
    console.error('Erro ao buscar vaga por id: ', error);
    res.status(500).json({ mensagem: 'Erro interno ao buscar a vaga' });
  }
};

module.exports = {
    buscarVagasPorId
};
