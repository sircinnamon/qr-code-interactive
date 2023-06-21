let BitArr = require("./bitArray")

let QR = require("./qr.js")

let qr_test = new QR("TEST", version=1)
let qr_hello = new QR("HELLO", version=1)
let qr_nums = new QR("123456789", version=1)
console.log(qr_test.toTerminalString())
console.log(qr_hello.toTerminalString())
console.log(qr_nums.toTerminalString())

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