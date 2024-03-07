let QR = require("../qr.js")
let assert = require("assert")
// let fs = require("fs")
let text = ""


// console.log("============= TEST =============")
let qcodes = {}
qcodes["null"] = new QR(text.slice(0,10), {version: 1, unsafe_mask: "null"})
qcodes[0] = new QR(text.slice(0,10), {version: 1, unsafe_mask: 0})
qcodes[1] = new QR(text.slice(0,10), {version: 1, unsafe_mask: 1})
qcodes[2] = new QR(text.slice(0,10), {version: 1, unsafe_mask: 2})
qcodes[3] = new QR(text.slice(0,10), {version: 1, unsafe_mask: 3})
qcodes[4] = new QR(text.slice(0,10), {version: 1, unsafe_mask: 4})
qcodes[5] = new QR(text.slice(0,10), {version: 1, unsafe_mask: 5})
qcodes[6] = new QR(text.slice(0,10), {version: 1, unsafe_mask: 6})
qcodes[7] = new QR(text.slice(0,10), {version: 1, unsafe_mask: 7})

describe("Mask Patterns", () => {
	describe("Mask specifier", () => {
		describe("Should match mask", () => {
			// console.log(qcodes)
			// console.log(qcodes[0])
			let valid_masks = [
				qcodes[0],
				qcodes[1],
				qcodes[2],
				qcodes[3],
				qcodes[4],
				qcodes[5],
				qcodes[6],
				qcodes[7]
			]
			valid_masks.forEach((q, i) => {
				it(`Mask ${i}`, () => {
					let xor = [1,0,1] // Format string has a fixed mask applied
					let extracted_mask = [
						q.modules.get(2, 8),
						q.modules.get(3, 8),
						q.modules.get(4, 8)
					]
					for (let j = extracted_mask.length - 1; j >= 0; j--) {
						extracted_mask[j] = extracted_mask[j] ^ xor[j]
					}
					extracted_mask = extracted_mask.join("")
					let bitMap = {
						"000": 0,
						"001": 1,
						"010": 2,
						"011": 3,
						"100": 4,
						"101": 5,
						"110": 6,
						"111": 7
					}
					assert.equal(bitMap[extracted_mask], i)
				})
			})
		})
	})
})
