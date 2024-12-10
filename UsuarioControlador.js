const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {validationResult} = require('express-validation');
const Usuario = require('./modeloUsuario');

const segredo = process.env.JWT_SECRET;
const segredoRenovacao = process.env.JWT_REFRESH_SECRET;

const gerarToken = (usuario) => {
    const acessToken = jwt.sign({nome: usuario.nome},segredo,{expiresIn: '1h'});
    const refreshToken = jwt.sign({nome: usuario.nome},segredoRenovacao,{expiresIn: '7d'});
    return {acessToken, refreshToken};
};

const registrarUsuario = async (req,res) => {
    const erros = validationResult(req);
    if(!erros.isEmpty()) {
        return res.status(400).json({erros: erros.array()});
    }
    const {nome, senha} = req.body;

    try {
        const senhaCriptografada = bcrypt.hashSync(senha, 10);
        const novoUsuario = new Usuario({nome,senha : senhaCriptografada});
        await novoUsuario.save();
    
        res.status(201).json({mensagem: 'usuário criado com sucesso'});
    } catch (erro) {
        res.status(500).json({mensagem: 'Erroao criar usuário\,', erro});
    }
};

const loginUsuario = async (req,res) => {
    const erros = validationResult(req);
    if(!erros.isEmpty()) {
        return res.status(400).json({erros: erros.array()});
    }

    const {nome, senha} = req.body;

    try {
        const usuario = await Usuario.findOne({nome});
        if(!usuario) {
            return res.status(400).json({mensagem: 'usuário não encontrado'});
        }
        const senhaValida = bcrypt.compareSync(senha, usuario.senha);
        if(!senhaValida) {
            return res.status(401).json({mensagem: 'senha inválida'});
        }
        const tokens = gerarToken(usuario);
        res.json({tokens});
    } catch (erro) {
        res.status(500).json({mensagem: 'Erro ao logar usuário', erro});
    }
};

const renovarToken = async (req,res) => {
    const {refreshToken} = req.body;
    if(!refreshToken){
        return res.status(403).json({mensagem: 'token de renovação não encontrado'});
    }
    jwt.verify(refreshToken, segredoRenovacao, (erro,usuario) => {
        if (erro) {
            return res.status(403).json({mensagem: 'Token de renovação invalido'});
        }
        const novoAcessToken = jwt.sign({nome: usuario.nome},segredoAcesso,{expiresIn: '1h'});
        res.json({acessToken: novoAcessToken});
    });
};

module.exports = {registrarUsuario, loginUsuario, renovarToken};