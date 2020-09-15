let getStx = () => {

    let unicode = 2;
    let character = String.fromCharCode(unicode);
    let stx = character.toString();

    return stx;

};

let getEtx = () => {

    let unicode = 3;
    let character = String.fromCharCode(unicode);
    let etx = character.toString();

    return etx;

};

module.exports = {
    getStx,
    getEtx
}