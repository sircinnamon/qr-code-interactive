let QR = require("../qr.js")

console.log("============= HELLO WORLD =============")
qr_test = new QR("HELLO WORLD", version=1, ec_level="Q")
console.log(qr_test.toTerminalString())
