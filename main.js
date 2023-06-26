let BitArr = require("./bitArray")

let QR = require("./qr.js")

console.log("============= TEST =============")
let qr_test = new QR("TEST")
console.log(qr_test.toTerminalString())

console.log("============= HELLO =============")
let qr_hello = new QR("HELLO")
console.log(qr_hello.toTerminalString())

console.log("============= 123456789 =============")
let qr_nums = new QR("123456789", {version:2})
// console.log(qr_nums.toTerminalString())

console.log("============= VER 5 =============")
let qr_med = new QR("THIS IS A VER 5 QR CODE WITH HIGHER CAPACITY", {version:5})
// console.log(qr_med.toTerminalString())

console.log("============= VER 6 =============")
let qr_six = new QR("THIS IS A SLIGHTLY LARGER QR CODE.", {version:6})
// console.log(qr_six.toTerminalString())

console.log("============= VER 7 =============")
let qr_long = new QR("THIS IS A LARGER QR CODE WITH HIGH CAPACITY AND VER INFO BLOCK. 66 CODEWORDS CAN DO 93 CHARS.", {version:7})
// console.log(qr_long.toTerminalString())

console.log("============= NUMERIC =============")
let qr_numeric = new QR(10101994, {version:2})
// console.log(qr_numeric.toTerminalString())

console.log("============= NUMERIC SMALL=============")
let qr_numerics = new QR(5555, {version:1})
console.log(qr_numerics.toTerminalString())

console.log("============= BYTES SMALL=============")
let qr_bytes = new QR("sheep baa")
console.log(qr_bytes.toTerminalString())


// console.log("============= EVERY VERSION/EC =============")
// let text = "A SHORT GENERIC TEXT"
// for (let i = 1; i <= 40; i++) {
// 	for (let j = 0; j < 4; j++) {
// 		let ec = "LMQH"[j]
// 		let ver = i
// 		let qr = new QR(text, version=ver, ec_level=ec)
// 	}
// }

// let bitSeq = qr.alphanumericEncode("AC-42")
// bitSeq = qr.addTerminator(bitSeq, 152)
// console.log(bitArray.toString(bitSeq))
// console.log(bitArray.toString(bitSeq).match(/.{1,8}/g))
// let codewords = qr.convertBitStreamToCodewords(bitSeq)
// console.log(codewords)
// let padded_codewords = qr.padCodewordToCapacity(codewords, 9) // 9 is capacity of high EC type 1
// console.log(padded_codewords)

// let GF256 = require("./gf256")
// let ReedSolomon = require("./reedSolomon")
// codewords = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17]
// let codewords_polynomial = ReedSolomon.codewords_to_polynomial(codewords)
// let generator_polynomial = ReedSolomon.generator_polynomial(10) // Ten for a 1-M code
// let ecc = ReedSolomon.calculate_ecc(generator_polynomial, codewords_polynomial)
// console.log(ecc)

// let TwoDArray = require("./TwoDArray")
// let two = new TwoDArray(5,5,0)
// console.log(two.copy(1,1,[[1],[2,3],[4,5,6]]))
// console.log(two.data)