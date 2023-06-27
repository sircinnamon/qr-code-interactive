let MicroQR = require("../microqr")
let alpha = "ABCDEFGH"
let bytes = "abcdefghijklmno"


console.log("============= TEST M1 =============")
qr_test = new MicroQR(10109, {version: 1})
console.log(qr_test.toTerminalString())

console.log("============= TEST M2L =============")
qr_test = new MicroQR(alpha.slice(0,5), {version: 2,ec_level:"L"})
console.log(qr_test.toTerminalString())

console.log("============= TEST M3L =============")
qr_test = new MicroQR(alpha, {version: 3})
console.log(qr_test.toTerminalString())

console.log("============= TEST M3M =============")
qr_test = new MicroQR(alpha, {version: 3, ec_level: "M"})
console.log(qr_test.toTerminalString())

console.log("============= TEST M4L =============")
qr_test = new MicroQR(bytes, {version: 4,ec_level:"L"})
console.log(qr_test.toTerminalString())

console.log("============= TEST M4Q =============")
qr_test = new MicroQR(bytes.slice(6), {version: 4,ec_level:"Q"})
console.log(qr_test.toTerminalString())
