const GF256 = require("./gf256")
class ReedSolomon {

	static ec_stage(generator_polynomial, codewords_polynomial){
		let stagegenres = generator_polynomial.map((g,i) => {
			let alpha = codewords_polynomial[codewords_polynomial.length-1]
			g = (g + alpha) % 255
			return g
		})
		let stagecoderes = codewords_polynomial.map((c, i) => {
			i = i + (stagegenres.length - codewords_polynomial.length)
			let xor = GF256.antilog(stagegenres[i]) || 0
			c = GF256.log(GF256.antilog(c) ^ xor)
			return c
		})
		// Handle XOR 0's from generator to codeword
		if(stagegenres.length>codewords_polynomial.length){
			let extra_digits = Math.abs(stagegenres.length - codewords_polynomial.length)
			let terms = stagegenres.slice(0,extra_digits)
			stagecoderes = [...terms, ...stagecoderes]
		}
		stagecoderes = stagecoderes.filter(x=>x!==undefined)
		return [stagegenres, stagecoderes]
	}

	static calculate_ecc(generator_polynomial, codewords_polynomial){
		let cycles = codewords_polynomial.length
		for (var i = cycles; i > 0; i--) {
			// console.log("Step "+(codewords.length-i))
			let result = ReedSolomon.ec_stage(generator_polynomial, codewords_polynomial)
			// console.log("A",result)
			// console.log("B",result2)
			// generator_polynomial = result[0]
			codewords_polynomial = result[1]
			// console.log(codewords_polynomial.map(x=>GF256.antilog(x)))
			// console.log(generator_polynomial)
		}
		codewords_polynomial.reverse()
		return codewords_polynomial.map(x=>GF256.antilog(x))
	}

	static codewords_to_polynomial(codewords){
		// Functions assume polynomials are stored BACKWARDS and in GF256 alpha notation
		// This will convert an array of bytes (as ints) to conform
		let codewords_polynomial = [...codewords] // safely dupe
		codewords_polynomial.reverse()
		codewords_polynomial = codewords_polynomial.map(x=>GF256.log(x))
		return codewords_polynomial
	}

	static generator_polynomial(codewords){
		console.log("CODEWORD LOOKUP "+codewords)
		return ReedSolomon.GENERATOR_POLYNOMIAL_LOOKUP()[codewords]
	}

	static GENERATOR_POLYNOMIAL_LOOKUP(){
		// Annex A Table A.1 pg 81 (https://www.thonky.com/qr-code-tutorial/generator-polynomial-tool)
		// index = number of error correction codewords
		// each element e = 1 term of the polynomial
		// index i = power of x, e[i] = power of alpha α (2)
		return {
			2: [1, 25, 0], // (α^1)(x^0) + (α^25)(x^1) + (α^0)(x^2) = x^2 + (α^25)x + α
			5: [],
			6: [],
			7: [],
			8: [],
			10: [45, 32, 94, 64, 70, 118, 61, 46, 67, 251, 0],
			13: [],
			14: [],
			15: [],
			16: [],
			17: [136, 163, 243, 39, 150, 99, 24, 147, 214, 206, 123, 239, 43, 78, 206, 139, 43, 0],
			28: [123,9,37,242,119,212,195,42,87,245,43,21,201,232,27,205,147,195,190,110,180,108,234,224,104,200,223,168,0]
		}
	}
}

module.exports = ReedSolomon