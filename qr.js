let BitArr = require("./bitArray")
let TwoDArray = require("./TwoDArray")
let ReedSolomon = require("./reedSolomon")

class QR{
	constructor(input, version = 1, ec_level="H"){
		this.version = version
		this.ec_level = ec_level
		this.measure = version * 4 + 17
		this.modules = new TwoDArray(this.measure, this.measure, 0)
		this.locked_modules = new TwoDArray(this.measure, this.measure, 0)
		this.input = input
		this.build()
	}

	build(){
		this.modules = new TwoDArray(this.measure, this.measure, 0)
		this.locked_modules = new TwoDArray(this.measure, this.measure, 0)
		this.addFinderPatterns()
		this.addAlignmentPatterns(this.constructor.ALIGNMENT_PATTERN_LOCATIONS(version))
		this.addTimingPatterns()
		this.addDarkModule()
		this.reserveMetadataLocations()
		this.data_mode = this.constructor.DETERMINE_DATA_MODE(this.input)
		this.encoded_content = this.convertBitStreamToCodewords(
			this.addTerminator(this.encode(this.input), this.codeword_capacity()*8))
		this.encoded_padded_content = this.padCodewordToCapacity(this.encoded_content, 9)
		this.ec_codewords = this.generateECC()
		this.final_message = this.interleaveData(this.encoded_padded_content, this.ec_codewords)
		this.placeData(this.final_message)
		this.mask = this.chooseDataMask()
		this.applyDataMask(this.mask.func)
		this.formatString = this.generateFormatString()
		this.placeFormatString()
	}

	addFinderPatterns(){
		let locked_map = new TwoDArray(8,8,1)
		this.modules.copy(0,0,this.constructor.FINDER_PATTERN())
		this.locked_modules.copy(0,0,locked_map.data)
		this.modules.copy(0,this.measure-7,this.constructor.FINDER_PATTERN())
		this.locked_modules.copy(0,this.measure-8,locked_map.data)
		this.modules.copy(this.measure-7,0,this.constructor.FINDER_PATTERN())
		this.locked_modules.copy(this.measure-8,0,locked_map.data)
	}

	addAlignmentPatterns(locations){
		let locked_map = new TwoDArray(5,5,1)
		for(let j = 0; j<locations.length; j++){
			for(let k = 0; k<locations.length; k++){
				let centerx = locations[j]
				let centery = locations[k]
				let valid_module = true
				if(this.locked_modules.get(centerx,centery)){continue}
				for(let sub_x = centerx-2; sub_x < centerx+3; sub_x++){
					for(let sub_y = centery-2; sub_y < centery+3; sub_y++){
						if(this.locked_modules.get(sub_x,sub_y)){
							valid_module=false; break
						}
					}
				}
				if(valid_module){
					this.modules.copy(centerx-2,centery-2,this.constructor.ALIGNMENT_PATTERN())
					this.locked_modules.copy(centerx-2,centery-2,locked_map.data)
				}
			}	
		}
	}

	addTimingPatterns(){
		// vertical
		for (let y = 0; y < this.modules.height; y++) {
			if(!this.locked_modules.get(6, y)){
				this.modules.set(6,y,((y+1)%2))
				this.locked_modules.set(6,y,1)
			}
		}
		// horizontal
		for (let x = 0; x < this.modules.width; x++) {
			if(!this.locked_modules.get(x, 6)){
				this.modules.set(x,6,((x+1)%2))
				this.locked_modules.set(x,6,1)
			}
		}
	}

	addDarkModule(){
		this.modules.set(8, this.modules.height-8, 1)
		this.locked_modules.set(8, this.modules.height-8, 1)
	}

	reserveMetadataLocations(){
		// Just lock these pixels because we wont know them all
		// Until data is placed into code
		// But locations are fixed so we can place later
		//Under top left pattern
		let [x,y] = [0, 8]
		while(x<9){
			this.locked_modules.set(x,y,1)
			x++;
		}
		//right of top left pattern
		[x,y] = [8,0]
		while(y<9){
			this.locked_modules.set(x,y,1)
			y++;
		}
		// under top right pattern
		[x,y] = [this.measure-8,8]
		while(x<this.measure){
			this.locked_modules.set(x,y,1)
			x++;
		}
		// right of lowerleft pattern
		[x,y] = [8,this.measure-8]
		while(y<this.measure){
			this.locked_modules.set(x,y,1)
			y++;
		}

		if(this.version < 7){return}
		let reserveBlock = new TwoDArray(6,3,1).data
		this.locked_modules.copy(this.measure-11,0,reserveBlock)
		reserveBlock = new TwoDArray(3,6,1).data
		this.locked_modules.copy(0,this.measure-11,reserveBlock)

	}

	encode(data) {
		if(this.data_mode == "alphanumeric"){return this.alphanumericEncode(data)}
	}

	calculateAlphanumericDatastreamLength(dlen, mode_indicator_bitlen, char_count_bitlen){
		// Mode indicator = 4 for QR, other for Mini
		// Char count bitlen varies w/ mode + size (Table 3)
		return mode_indicator_bitlen + char_count_bitlen + 11*(Math.floor(dlen/2)) + 6*(dlen%2)
	}

	alphanumericEncode(input){
		let values = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"
		let bitSeq = []
		let mode = 0x2
		let charCount = input.length
		bitSeq = BitArr.concat(bitSeq, [BitArr.partial(4, 2)]) // 4 bits, value = 0010 (alphanumeric)
		bitSeq = BitArr.concat(bitSeq, [BitArr.partial(9, charCount)]) // 9 bits, value = charCount
		input = input.match(/.{1,2}/g) // 2 char groups
		for (let i = 0; i < input.length; i++) {
			let block = input[i]
			let val
			if(block.length==1){
				// 6 digit binary
				val = values.indexOf(block[0])
				bitSeq = BitArr.concat(bitSeq, [BitArr.partial(6, val)])
			} else {
				// 11 digit binary
				val = (values.indexOf(block[0])*45) + values.indexOf(block[1])
				bitSeq = BitArr.concat(bitSeq, [BitArr.partial(11, val)])
			}
		}
		// console.log(this.calculateAlphanumericDatastreamLength(charCount, 4, 9))
		// console.log(bitArray.bitLength(bitSeq))
		return bitSeq
	}

	addTerminator(bitSeq, codeword_capacity){
		let symbolCapacity = codeword_capacity*8
		if(BitArr.bitLength(bitSeq) < symbolCapacity){
			bitSeq = BitArr.concat(bitSeq, [BitArr.partial(4, 0)])
		}
		if(BitArr.bitLength(bitSeq) > symbolCapacity){
			bitSeq = BitArr.bitSlice(bitSeq, 0, symbolCapacity)
		}
		return bitSeq
	}

	// Bitstream should include terminator
	// Convert arbitrary length bitstream to 8bit codewords
	convertBitStreamToCodewords(bitSeq){
		if(BitArr.bitLength(bitSeq) % 8 !== 0){
			let missing = 8-BitArr.bitLength(bitSeq)%8
			bitSeq = BitArr.concat(bitSeq, [BitArr.partial(missing, 0)])
		}
		let buf = Buffer.from([])
		while(BitArr.bitLength(bitSeq) !== 0){
			let byte = BitArr.extract(bitSeq, 0, 8)
			bitSeq = BitArr.bitSlice(bitSeq, 8)
			let newbuf = Buffer.alloc(1)
			newbuf.writeUInt8(byte)
			buf = Buffer.concat([buf, newbuf])
		}
		return buf
	}

	padCodewordToCapacity(buf, capacity){
		// Capacity in BYTES/Codewords
		let pad1 = 0xEC
		let pad2 = 0x11
		let padBuffer = Buffer.alloc(2)
		padBuffer.writeUInt8(pad1)
		padBuffer.writeUInt8(pad2, 1)
		while(buf.length+1 < capacity){
			buf = Buffer.concat([buf, padBuffer])
		}
		if(buf.length < capacity){
			padBuffer = padBuffer.slice(0,1)
			buf = Buffer.concat([buf, padBuffer])
		}
		return buf
	}

	calculateECCCount(){
		let ver = this.version
		let ec_level = "LMQH".indexOf(this.ec_level)
		return this.constructor.EC_CHARACTERISTICS()[ver][ec_level].ec_codewords
	}

	generateECC(){
		let codewords_polynomial = ReedSolomon.codewords_to_polynomial(this.encoded_padded_content)
		let ecc_count = this.calculateECCCount()
		let generator_polynomial = ReedSolomon.generator_polynomial(ecc_count)
		let ecc = ReedSolomon.calculate_ecc(generator_polynomial, codewords_polynomial)
		return ecc
	}

	interleaveData(data_codewords, ec_codewords){
		if(this.version < 40){
			return [...data_codewords, ...ec_codewords]
		}
	}

	placeData(message){
		let location = 0
		// console.log(message.length)
		for(let i = 0; i< message.length; i++){
			// console.log(`codeword ${i} = ${message[i]} - starts at ${location}(${this.dataLocationToXY(location)})`)
			let codeword = message[i]
			location = this.placeCodewordModules(codeword, location)
			// console.log(this.toTerminalString())
			// if(i>3){return}
		}
	}

	placeCodewordModules(codeword, location){
		// Location is the module to start in - it can be converted to xy
		// with some work, and counts all modules, even reserved
		// We should return end location of this codeword + 1
		let x,y
		let bits = this.constructor.BYTE_TO_BINARY(codeword)
		// console.log(bits)
		for (let i = 0; i < bits.length; i++) {
			[x,y] = this.dataLocationToXY(location)
			while(this.locked_modules.get(x,y)){
				// console.log(`SKIP LOC ${location}(${[x,y]})`)
				location++
				[x,y] = this.dataLocationToXY(location)
			}
			this.modules.set(x,y,bits[i])
			// console.log(`${bits[i]} placed at ${x}, ${y} - ${location}`)
			location++
		}
		return location
	}

	dataLocationToXY(location){
		// Which double-width column are we in
		let dubCol = Math.floor(location / (this.measure*2))
		let odd = location % 2
		let x = (this.measure-1) - ((dubCol*2) + odd)
		// Final 3 dubCols (left side)
		if(dubCol >= ((this.measure-1)/2)-3){
			 // shift back out of col 6
			x--
		}		
		// If dubcol is even, y counts up, odd it counts down
		let y = Math.floor((location % (this.measure*2)) / 2)
		if(dubCol%2==0){
			y = (this.measure-1) - y
		}
		return [x, y]
	}

	chooseDataMask(){
		// TODO: make this smarter
		return this.constructor.DATA_MASKS()[6]
	}

	applyDataMask(maskFunc){
		for (let x = this.measure - 1; x >= 0; x--) {
			for (let y = this.measure - 1; y >= 0; y--) {
				if(!this.locked_modules.get(x,y)){
					if(maskFunc(x,y)){
						this.modules.set(x,y,
							this.modules.get(x,y)?0:1
						)
					}
				}
			}
		}
	}

	generateFormatString(){
		let ec = "MLHQ".indexOf(this.ec_level)
		let mask_id = this.mask.id
		let bitSeq = []
		bitSeq = BitArr.concat(bitSeq, [BitArr.partial(2, ec)]) // 2 bits, value ec
		bitSeq = BitArr.concat(bitSeq, [BitArr.partial(3, mask_id)])
		let formatString = [...bitSeq]
		bitSeq = BitArr.concat(bitSeq, [BitArr.partial(10, 0)])
		while(BitArr.toString(bitSeq).startsWith("0")){
			bitSeq = BitArr.bitSlice(bitSeq, 1)
		}
		// format string = 15 bits
		let initial_generator = BitArr.concat([], [BitArr.partial(11, 1335)]) //10100110111
		let generator
		// generator also 15 bits long
		while(BitArr.bitLength(bitSeq) > 10){
			let needed_zeroes = BitArr.bitLength(bitSeq) - BitArr.bitLength(initial_generator)
			generator = []
			if(needed_zeroes>0){
				generator = BitArr.concat(initial_generator, [BitArr.partial(needed_zeroes, 0)])
			} else {
				generator = initial_generator
			}
			let n = BitArr.extract(bitSeq, 0, BitArr.bitLength(bitSeq)) ^ BitArr.extract(generator, 0, BitArr.bitLength(generator))
			bitSeq = [BitArr.partial(15,n)]
			while(BitArr.toString(bitSeq).startsWith("0")){
				bitSeq = BitArr.bitSlice(bitSeq, 1)
			}
		}
			formatString = BitArr.concat(
			formatString, 
			[BitArr.partial(10, BitArr.extract(bitSeq, 0, BitArr.bitLength(bitSeq)))]
		)
		let formatStringVal = BitArr.extract(formatString, 0, BitArr.bitLength(formatString))
		formatStringVal = formatStringVal ^ 21522 //mask: 101010000010010
		formatString = [BitArr.partial(15, formatStringVal)]
		formatString = BitArr.toString(formatString)
		return formatString
	}

	lookupFormatString(){
		//Alternative to generateFormatString
		let key = this.ec_level + this.mask.id
		return this.constructor.FORMAT_STRINGS()[key]
	}

	placeFormatString(){
		let fs = this.formatString
		let m = this.measure-1
		let locations = [
			[[0,8], [8,m]],
			[[1,8], [8,m-1]],
			[[2,8], [8,m-2]],
			[[3,8], [8,m-3]],
			[[4,8], [8,m-4]],
			[[5,8], [8,m-5]],
			[[7,8], [8,m-6]],
			[[8,8], [m-7,8]],
			[[8,7], [m-6,8]],
			[[8,5], [m-5,8]],
			[[8,4], [m-4,8]],
			[[8,3], [m-3,8]],
			[[8,2], [m-2,8]],
			[[8,1], [m-1,8]],
			[[8,0], [m,8]]
		]
		for(let i=0; i<fs.length; i++){
			let v = fs[i]-0
			this.modules.set(locations[i][0][0],locations[i][0][1],v)
			this.modules.set(locations[i][1][0],locations[i][1][1],v)
		}
	}

	codeword_capacity(){
		// return data bits available in current version
		let ver = this.version
		let ec_level = "LMQH".indexOf(this.ec_level)
		return this.constructor.DATA_CHARACTERISTICS()[ver][ec_level].data_codewords
	}

	toTerminalString(){
		let bl = this.constructor.BLANK_LINE(this.modules.data[0].length+7)
		let t = `████████`
		let out = `${bl}${bl}`
		for(let y=0; y < this.modules.data.length; y++){
			out+=`${t}`
			for(let x=0; x < this.modules.data[0].length; x++){
				if(this.modules.data[y][x]){out+="  "}
				else(out+="██")
			}
			out+=`${t}\n`
		}
		out+=`${bl}${bl}`
		return out
	}

	lockedToTerminalString(){
		let bl = this.constructor.BLANK_LINE(this.locked_modules.data[0].length+7)
		let t = `████████`
		let out = `${bl}${bl}`
		for(let y=0; y < this.locked_modules.data.length; y++){
			out+=`${t}`
			for(let x=0; x < this.locked_modules.data[0].length; x++){
				if(this.locked_modules.data[y][x]){out+="  "}
				else(out+="██")
			}
			out+=`${t}\n`
		}
		out+=`${bl}${bl}`
		return out
	}

	static DETERMINE_DATA_MODE(data) {
		// Support numeric, alphanumeric, bytes, kanji
		return "alphanumeric"
	}

	static FINDER_PATTERN(){
		return [
			[1,1,1,1,1,1,1],
			[1,0,0,0,0,0,1],
			[1,0,1,1,1,0,1],
			[1,0,1,1,1,0,1],
			[1,0,1,1,1,0,1],
			[1,0,0,0,0,0,1],
			[1,1,1,1,1,1,1]
		]
	}

	static ALIGNMENT_PATTERN(){
		return [
			[1,1,1,1,1],
			[1,0,0,0,1],
			[1,0,1,0,1],
			[1,0,0,0,1],
			[1,1,1,1,1]
		]
	}

	static ALIGNMENT_PATTERN_LOCATIONS(version){
		let list = {
			1: [],
			2: [6,18]
		}
		return list[version]
	}

	static TIMING_PATTERN(w){
		let out = []
		while (out.length < w){
			out.push((out.length%2)?0:1) // Alternate starting with black/1
		}
		return out
	}

	static BLANK_LINE(w){
		let out = ""
		while (out.length <= 2*w){
			out += "██"
		}
		return out+"\n"
	}

	static BYTE_TO_BINARY(byte){
		// Take byte as int
		let curr_bit
		let out = []
		for (let i = 0; i < 8; i++) {
			curr_bit = byte & 128
			if(curr_bit){out.push(1)}
			else{out.push(0)}
			byte = byte << 1
		}
		return out
	}

	static DATA_MASKS(){
		return {
			0 : {
				func: (x, y) => {return ((x+y)%2)==0},
				id: 0
			},
			1 : {
				func: (x, y) => {return y%2==0},
				id: 1
			},
			2 : {
				func: (x, y) => {return x%3==0},
				id: 2
			},
			3 : {
				func: (x, y) => {return (x+y)%3==0},
				id: 3
			},
			4 : {
				func: (x, y) => {
					let a = Math.floor(y/2)
					let b = Math.floor(x/3)
					return (a+b)%2==0
				},
				id: 4
			},
			5 : {
				func: (x, y) => {return ((x*y)%2)+((x*y)%3)==0},
				id: 5
			},
			6 : {
				func: (x, y) => {
					let xy = x*y
					return ((xy%2)+(xy%3))%2==0
				},
				id: 6
			},
			7 : {
				func: (x, y) => {return ((((x+y)%2)+((x*y)%3))%2)==0},
				id: 7
			}
		}
	}

	static FORMAT_STRINGS(){
		return {
			"L0":"111011111000100",
			"L1":"111001011110011",
			"L2":"111110110101010",
			"L3":"111100010011101",
			"L4":"110011000101111",
			"L5":"110001100011000",
			"L6":"110110001000001",
			"L7":"110100101110110",
			"M0":"101010000010010",
			"M1":"101000100100101",
			"M2":"101111001111100",
			"M3":"101101101001011",
			"M4":"100010111111001",
			"M5":"100000011001110",
			"M6":"100111110010111",
			"M7":"100101010100000",
			"Q0":"011010101011111",
			"Q1":"011000001101000",
			"Q2":"011111100110001",
			"Q3":"011101000000110",
			"Q4":"010010010110100",
			"Q5":"010000110000011",
			"Q6":"010111011011010",
			"Q7":"010101111101101",
			"H0":"001011010001001",
			"H1":"001001110111110",
			"H2":"001110011100111",
			"H3":"001100111010000",
			"H4":"000011101100010",
			"H5":"000001001010101",
			"H6":"000110100001100",
			"H7":"000100000111011"
		}
	}

	static DATA_CHARACTERISTICS(){
		// Table 7 pg 41
		return [
			[], //no ver 0
			[
				{
					type: "1L",
					data_codewords: 19
				},
				{
					type: "1M",
					data_codewords: 16
				},
				{
					type: "1Q",
					data_codewords: 13
				},
				{
					type: "1H",
					data_codewords: 9
				},
			],
			[
				{
					type: "2L",
					data_codewords: 34
				},
				{
					type: "2M",
					data_codewords: 28
				},
				{
					type: "2Q",
					data_codewords: 22
				},
				{
					type: "2H",
					data_codewords: 16
				},
			]
		]
	}

	static EC_CHARACTERISTICS(){
		// table 9 pg 46
		return [
			[], //no ver 0
			[
				{
					type: "1L",
					ec_codewords: 7
				},
				{
					type: "1M",
					ec_codewords: 10
				},
				{
					type: "1Q",
					ec_codewords: 13
				},
				{
					type: "1H",
					ec_codewords: 17
				},
			],
			[
				{
					type: "2L",
					ec_codewords: 10
				},
				{
					type: "2M",
					ec_codewords: 16
				},
				{
					type: "2Q",
					ec_codewords: 22
				},
				{
					type: "2H",
					ec_codewords: 28
				},
			]
		]
	}
}

module.exports = QR