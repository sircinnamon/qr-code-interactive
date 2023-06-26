let BitArr = require("./bitArray")
let TwoDArray = require("./TwoDArray")
let ReedSolomon = require("./reedSolomon")
let QR_Scorer = require("./qr_scorer")
let QR_CHARACTERISTICS = require("./qr_characteristics.json").characteristics

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
		this.encoded_content = this.encode(this.input)
		this.encoded_content = this.addTerminator(this.encoded_content, this.codeword_capacity())
		this.codewords = this.convertBitStreamToCodewords(this.encoded_content)
		this.encoded_padded_content = this.padCodewordToCapacity(this.codewords, this.codeword_capacity())
		//Split into groups for EC generation
		this.data_groups = this.splitDataGroups()
		this.ec_codeword_groups = this.generateECC()
		this.final_message = this.interleaveData(this.data_groups, this.ec_codeword_groups)
		// console.log(JSON.stringify(this.final_message))
		// console.log(this.final_message.length)
		this.placeData(this.final_message)
		if(this.version >= 7){
			this.versionInfoString = this.lookupVersionInfoString()
			this.placeVersionInfoString()
		}
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
		// Sanitize input
		input = input.split("").filter(x=>values.indexOf(x)!==-1).join("")
		let bitSeq = []
		let mode = 0x2
		let charCount = input.length
		let charCountBits = 9
		if(this.version >= 10){charCountBits=11}
		if(this.version >= 27){charCountBits=13}
		bitSeq = BitArr.concat(bitSeq, [BitArr.partial(4, 2)]) // 4 bits, value = 0010 (alphanumeric)
		bitSeq = BitArr.concat(bitSeq, [BitArr.partial(charCountBits, charCount)]) // 9/11/13 bits, value = charCount
		console.log(this.version, charCountBits, BitArr.bitLength(bitSeq))
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
		if(BitArr.bitLength(bitSeq) < symbolCapacity){
			while(BitArr.bitLength(bitSeq) % 8 != 0){
				bitSeq = BitArr.concat(bitSeq, [BitArr.partial(1, 0)])
			}
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

	splitDataGroups(){
		let raw = Buffer.from(this.encoded_padded_content)
		let chars = this.characteristics()
		if(!chars.groups){
			// All data is in one group, all ec in one group
			return [raw]
		}
		let split = []
		let offset = 0
		for (let i = 0; i < chars.groups.length; i++) {
			for(let j = 0; j < chars.groups[i].blocks; j++){
				let size = chars.groups[i].data
				let buf = Buffer.alloc(size)
				raw.copy(buf, 0, offset, offset+size)
				split.push(buf)
				offset+=size
			}
		}
		return split
	}

	generateECC(){
		let groups = []
		for (let i = 0; i < this.data_groups.length; i++) {
			let codewords = this.data_groups[i]
			let codewords_polynomial = ReedSolomon.codewords_to_polynomial(codewords)
			let ecc_count = this.characteristics().ec_codewords_per_block || this.characteristics().ec_codewords
			let generator_polynomial = ReedSolomon.generator_polynomial(ecc_count)
			let ecc = ReedSolomon.calculate_ecc(generator_polynomial, codewords_polynomial)
			groups.push(ecc)
		}
		return groups
	}

	interleaveData(data_codewords, ec_codewords){
		// data_codewords = array of groups of codewords
		// ec_codewords = array of groups of ec codewords
		if(data_codewords.length === 1 && ec_codewords.length === 1){
			return [...data_codewords[0], ...ec_codewords[0]]
		}
		let interleavedDataCodewords = []
		for (let i = 0; i < data_codewords[data_codewords.length-1].length; i++) {
			for(let j = 0; j < data_codewords.length; j++){
				if(data_codewords[j][i]!==undefined){
					interleavedDataCodewords.push(data_codewords[j][i])
				}
			}
		}
		let interleavedECCodewords = []
		for (let i = 0; i < ec_codewords[0].length; i++) {
			for(let j = 0; j < ec_codewords.length; j++){
				interleavedECCodewords.push(ec_codewords[j][i])
			}
		}
		return [...interleavedDataCodewords, ...interleavedECCodewords]
	}

	placeData(message){
		let location = 0
		for(let i = 0; i< message.length; i++){
			// console.log(`codeword ${i} = ${message[i]} - starts at ${location}(${this.dataLocationToXY(location)})`)
			let codeword = message[i]
			location = this.placeCodewordModules(codeword, location)
			// if(i%10===0){console.log(this.toTerminalString())}
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
		let scores = []
		for (let i = 0; i < 8; i++) {
			let module_copy = new TwoDArray(this.measure, this.measure, 0)
			module_copy.copy(0,0,this.modules.data)
			let mask = this.constructor.DATA_MASKS()[i]
			let formatString = this.generateFormatString(mask.id)
			this.placeFormatString(formatString, module_copy)
			this.applyDataMask(mask.func, module_copy)
			let score = QR_Scorer.score(module_copy)
			// console.log(`Mask ${i} score ${score}`)
			scores.push(score)
		}
		let winning_mask = scores.indexOf(Math.min(...scores))
		return this.constructor.DATA_MASKS()[6]
	}

	applyDataMask(maskFunc, modules){
		if(!modules){modules=this.modules}
		for (let x = this.measure - 1; x >= 0; x--) {
			for (let y = this.measure - 1; y >= 0; y--) {
				if(!this.locked_modules.get(x,y)){
					if(maskFunc(x,y)){
						modules.set(x,y,
							modules.get(x,y)?0:1
						)
					}
				}
			}
		}
	}

	generateFormatString(mask_id){
		let ec = "MLHQ".indexOf(this.ec_level)
		mask_id = mask_id!==undefined?mask_id:this.mask.id
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

	placeFormatString(fs, modules){
		if(!modules){modules=this.modules}
		if(!fs){fs=this.formatString}
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
			modules.set(locations[i][0][0],locations[i][0][1],v)
			modules.set(locations[i][1][0],locations[i][1][1],v)
		}
	}

	lookupVersionInfoString(){
		return this.constructor.VERSION_INFO_STRINGS()[this.version]
	}

	placeVersionInfoString(){
		let vis = this.versionInfoString.split("")
		vis.reverse()
		let m = this.measure-1
		for (let i = 0; i < vis.length; i++) {
			let v = vis[i]-0
			let x1 = Math.floor(i/3)
			let y1 = (m-10) + i%3
			let x2 = (m-10) + i%3
			let y2 = Math.floor(i/3)
			this.modules.set(x1,y1,v)
			this.modules.set(x2,y2,v)
		}
	}

	codeword_capacity(){
		// return data bits available in current version
		return this.characteristics().data_codewords
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

	toSVG(s = 15){
		// s = scaling
		let m = this.measure
		let d = (m+8)*s //Dimensions of whole svg, including whitespace
		let out = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n'
		out += '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n'
		out += `<svg width="${d}" height="${d}" viewBox="0 0 ${d} ${d}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n`
		out += `\t<rect fill="#FFF" x="0" y="0" width="${d}" height="${d}" />\n`
		out += `\t<g>\n`
		for(let y=0; y < this.modules.data.length; y++){
			for(let x=0; x < this.modules.data[0].length; x++){
				if(this.modules.data[y][x]){
					out+=`\t\t<rect x="${(x+4)*s}" y="${(y+4)*s}" width="${s}" height="${s}" fill="#000"/>\n`					
				}
			}
		}
		out += `\t</g>\n`
		out += `</svg>\n`
		return out
	}

	characteristics(){
		let ver = this.version
		let ec_level = "LMQH".indexOf(this.ec_level)
		// console.log(this.version, this.ec_level, "LMQH".indexOf(this.ec_level))
		return this.constructor.CHARACTERISTICS()[ver][ec_level]
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
		// Annex E Table E.1 pf 91
		let list = {
			1: [],
			2: [6,18],
			3: [6,22],
			4: [6,26],
			5: [6,30],
			6: [6,34],
			7: [6,22,38],
			8: [6,24,42],
			9: [6,26,46],
			10:[6,28,50],
			11:[6,30,54],
			12:[6,32,58],
			13:[6,34,62],
			14:[6,26,46,66],
			15:[6,26,48,70],
			16:[6,26,50,74],
			17:[6,30,54,78],
			18:[6,30,56,82],
			19:[6,30,58,86],
			20:[6,34,62,90],
			21:[6,28,50,72,94],
			22:[6,26,50,74,98],
			23:[6,30,54,78,102],
			24:[6,28,54,80,106],
			25:[6,32,58,84,110],
			26:[6,30,58,86,114],
			27:[6,34,62,90,118],
			28:[6,26,50,74,98,122],
			29:[6,30,54,78,102,126],
			30:[6,26,52,78,104,130],
			31:[6,30,56,82,108,134],
			32:[6,34,60,86,112,138],
			33:[6,30,58,86,114,142],
			34:[6,34,62,90,118,146],
			35:[6,30,54,78,102,126,150],
			36:[6,24,50,76,102,128,154],
			37:[6,28,54,80,106,132,158],
			38:[6,32,58,84,110,136,162],
			39:[6,26,54,82,110,138,166],
			40:[6,30,58,86,114,142,170]
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
			"test" : {
				func: (x, y) => {return 0},
				id: 0
			},
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

	static VERSION_INFO_STRINGS(){
		// No version info block on versions 1-6
		return [
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"000111110010010100",
			"001000010110111100",
			"001001101010011001",
			"001010010011010011",
			"001011101111110110",
			"001100011101100010",
			"001101100001000111",
			"001110011000001101",
			"001111100100101000",
			"010000101101111000",
			"010001010001011101",
			"010010101000010111",
			"010011010100110010",
			"010100100110100110",
			"010101011010000011",
			"010110100011001001",
			"010111011111101100",
			"011000111011000100",
			"011001000111100001",
			"011010111110101011",
			"011011000010001110",
			"011100110000011010",
			"011101001100111111",
			"011110110101110101",
			"011111001001010000",
			"100000100111010101",
			"100001011011110000",
			"100010100010111010",
			"100011011110011111",
			"100100101100001011",
			"100101010000101110",
			"100110101001100100",
			"100111010101000001",
			"101000110001101001"
		]
	}

	static CHARACTERISTICS(){
		// Table 7 pg 41
		// table 9 pg 46
		return QR_CHARACTERISTICS
	}
}

module.exports = QR