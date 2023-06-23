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
			5: [1, 119, 166, 164, 113, 5],
			6: [15, 176, 5, 134, 0, 166, 0],
			7: [21,102,238,149,146,229,87,0],
			8: [28,196,252,215,249,208,238,175,0],
			10: [45, 32, 94, 64, 70, 118, 61, 46, 67, 251, 0],
			13: [78,140,206,218,130,104,106,100,86,100,176,152,74,0],
			14: [91,22,59,207,87,216,137,218,124,190,48,155,249,199,0],
			15: [105,99,5,124,140,237,58,58,51,37,202,91,61,183,8,0],
			16: [120,225,194,182,169,147,191,91,3,76,161,102,109,107,104,120,0],
			17: [136, 163, 243, 39, 150, 99, 24, 147, 214, 206, 123, 239, 43, 78, 206, 139, 43, 0],
			18: [153,96,98,5,179,252,148,152,187,79,170,118,97,184,94,158,234,215,0],
			20: [190,188,212,212,164,156,239,83,225,221,180,202,187,26,163,61,50,79,60,17,0],
			22: [231,165,105,160,134,219,80,98,172,8,74,200,53,221,109,14,230,93,242,247,171,210,0],
			24: [21,227,96,87,232,117,0,111,218,228,226,192,152,169,180,159,126,251,117,211,48,135,121,229,0],
			26: [70,218,145,153,227,48,102,13,142,245,21,161,53,165,28,111,201,145,17,118,182,103,2,158,125,173,0],
			28: [123,9,37,242,119,212,195,42,87,245,43,21,201,232,27,205,147,195,190,110,180,108,234,224,104,200,223,168,0],
			30: [180,192,40,238,216,251,37,156,130,224,193,226,173,42,125,222,96,239,86,110,48,50,182,179,31,216,152,145,173,41,0]
		}
	}
}

module.exports = ReedSolomon