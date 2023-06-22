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
			let xor = GF256.antilog(stagegenres[i])
			if(c===undefined){
				return GF256.log(xor)
			}
			c = GF256.log(GF256.antilog(c) ^ xor)
			return c
		})
		// Handle XOR 0's from generator to codeword
		if(stagegenres.length>codewords_polynomial.length){
			let extra_digits = Math.abs(stagegenres.length - codewords_polynomial.length)
			let terms = stagegenres.slice(0,extra_digits)
			stagecoderes = [...terms, ...stagecoderes]
		}
		// stagecoderes = stagecoderes.filter(x=>x!==undefined)
		stagecoderes = stagecoderes.slice(0,-1)
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
		// console.log("CODEWORD LOOKUP "+codewords)
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
			28: [123,9,37,242,119,212,195,42,87,245,43,21,201,232,27,205,147,195,190,110,180,108,234,224,104,200,223,168,0],
			130: [225,140,201,246,32,134,13,213,74,205,107,7,170,118,155,221,205,190,169,228,67,74,57,170,123,56,2,77,111,50,186,46,181,208,166,35,147,77,214,36,71,142,237,204,70,196,145,1,233,14,92,198,153,141,85,60,54,1,58,100,7,71,43,193,18,76,144,190,166,65,127,91,175,244,168,45,196,123,6,177,197,245,80,229,244,166,166,171,75,106,161,252,46,35,231,245,247,160,4,250,6,251,183,20,71,251,189,107,120,8,127,159,226,118,4,146,206,40,218,181,152,121,116,126,52,44,68,153,234,44,0]
		}
	}
}

module.exports = ReedSolomon