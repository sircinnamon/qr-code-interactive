const QR = require("./qr")
let BitArr = require("./bitArray")
let TwoDArray = require("./TwoDArray")
let MicroQRScorer = require("./microqr_scorer")
let MICROQR_CHARACTERISTICS = require("./microqr_characteristics.json").characteristics

class MicroQR extends QR {

	constructor(input, options={}){
		let ec = options.ec_level || "L"
		super(input, {...options, ec_level: ec})
	}

	set_version(version){
		// console.log("SETVER", version)
		if(version < 1){version=1}
		if(version > 4){version=4}
		this.version = version
		this.measure = version * 2 + 9
		this.modules = new TwoDArray(this.measure, this.measure, 0)
		this.locked_modules = new TwoDArray(this.measure, this.measure, 0)
	}

	addFinderPatterns(){
		let locked_map = new TwoDArray(8,8,1)
		this.modules.copy(0,0,this.constructor.FINDER_PATTERN())
		this.locked_modules.copy(0,0,locked_map.data)
	}

	addAlignmentPatterns(){
		// Micro QR has no alignment patterns
	}

	addTimingPatterns(){
		// vertical
		for (let y = 0; y < this.modules.height; y++) {
			if(!this.locked_modules.get(0, y)){
				this.modules.set(0,y,((y+1)%2))
				this.locked_modules.set(0,y,1)
			}
		}
		// horizontal
		for (let x = 0; x < this.modules.width; x++) {
			if(!this.locked_modules.get(x, 0)){
				this.modules.set(x,0,((x+1)%2))
				this.locked_modules.set(x,0,1)
			}
		}
	}

	reserveMetadataLocations(){
		// Just lock these pixels because we wont know them all
		// Until data is placed into code
		// But locations are fixed so we can place later
		//Under top left pattern
		let [x,y] = [1, 8]
		while(x<9){
			this.locked_modules.set(x,y,1)
			x++;
		}
		//right of top left pattern
		[x,y] = [8,1]
		while(y<8){
			this.locked_modules.set(x,y,1)
			y++;
		}
	}

	charCountBits() {
		if(this.data_mode == "numeric"){
			if(this.version == 4){return 6}
			if(this.version == 3){return 5}
			if(this.version == 2){return 4}
			if(this.version == 1){return 3}
		}
		if(this.data_mode == "alphanumeric"){
			if(this.version == 4){return 5}
			if(this.version == 3){return 4}
			if(this.version == 2){return 3}
		}
		if(this.data_mode == "bytes"){
			if(this.version == 4){return 5}
			if(this.version == 3){return 4}
		}
		if(this.data_mode == "kanji"){
			if(this.version == 4){return 4}
			if(this.version == 3){return 3}
		}
	}

	modeCountBits() {
		return this.version - 1
	}

	modeId() {
		if(this.version === 4 || this.version === 3){
			if(this.data_mode == "numeric"){
				return 0x0
			}
			if(this.data_mode == "alphanumeric"){
				return 0x1
			}
			if(this.data_mode == "bytes"){
				return 0x2
			}
			if(this.data_mode == "kanji"){
				return 0x3
			}
		}
		if(this.version===2){
			if(this.data_mode == "numeric"){
				return 0x0
			}
			if(this.data_mode == "alphanumeric"){
				return 0x1
			}
		}
		if(this.version===1){
			if(this.data_mode == "numeric"){
				return 0x0
			}
		}
	}

	addDarkModule(){
		// Micro QR has no dark module
	}

	placeData(message){
		// console.log(this.version, message.map(x=>'0x'+x.toString(16)))
		if(this.version===4 || this.version===2){return(super.placeData(message))}
		// M1, M3L and M3M have irregular layouts
		if(this.version===1){
			return this.placeDataM1(message)
		}
		if(this.version===3){
			return this.placeDataM3(message)
		}
	}

	placeDataM1(message){
		let location = 0
		for(let i = 0; i< message.length; i++){
			let codeword = message[i]
			location = this.placeCodewordModules(codeword, location)
			if(i===2){
				location -= 4 // Codeword 3 is only bitlen 4 so step back
			}
		}
	}

	placeDataM3(message){
		let location = 0
		for(let i = 0; i< message.length; i++){
			let codeword = message[i]
			location = this.placeCodewordModules(codeword, location)
			if(i===10 && this.ec_level==="L"){
				location -= 4 // Codeword 11 is only bitlen 4 so step back
			}
			if(i===8 && this.ec_level==="M"){
				location -= 4 // Codeword 9 is only bitlen 4 so step back
			}
		}
	}

	dataLocationToXY(location){
		// Which double-width column are we in
		let dubCol = Math.floor(location / (this.measure*2))
		let odd = location % 2
		let x = (this.measure-1) - ((dubCol*2) + odd)
		// If dubcol is even, y counts up, odd it counts down
		let y = Math.floor((location % (this.measure*2)) / 2)
		if(dubCol%2==0){
			y = (this.measure-1) - y
		}
		return [x, y]
	}

	placeFormatString(fs, modules){
		if(!modules){modules=this.modules}
		if(!fs){fs=this.formatString}
		let m = this.measure-1
		let locations = [
			[1, 8],
			[2, 8],
			[3, 8],
			[4, 8],
			[5, 8],
			[6, 8],
			[7, 8],
			[8, 8],
			[8, 7],
			[8, 6],
			[8, 5],
			[8, 4],
			[8, 3],
			[8, 2],
			[8, 1]
		]
		for(let i=0; i<fs.length; i++){
			let v = fs[i]-0
			modules.set(locations[i][0],locations[i][1],v)
		}
	}

	chooseDataMask(){
		let scores = []
		for (let i = 0; i < 4; i++) {
			let module_copy = new TwoDArray(this.measure, this.measure, 0)
			module_copy.copy(0,0,this.modules.data)
			let mask = this.constructor.DATA_MASKS()[i]
			let formatString = this.generateFormatString(mask.id)
			this.placeFormatString(formatString, module_copy)
			this.applyDataMask(mask.func, module_copy)
			let score = MicroQRScorer.score(module_copy)
			// console.log(`Mask ${i} score ${score}`)
			scores.push(score)
		}
		let winning_mask = scores.indexOf(Math.min(...scores))
		return this.constructor.DATA_MASKS()[winning_mask]
	}

	generateFormatString(mask_id){
		let ec = this.ec_level
		mask_id = mask_id!==undefined?mask_id:this.mask.id
		let ver = this.version
		let symbol_num
		if(ec==="Q" && ver===4){symbol_num=7}
		else if(ec==="M"){
			if (ver===4){symbol_num=6}
			else if (ver===3){symbol_num=4}
			else if (ver===2){symbol_num=2}
		} else if(ec==="L"){
			if (ver===4){symbol_num=5}
			else if (ver===3){symbol_num=3}
			else if (ver===2){symbol_num=1}
		} else {
			symbol_num = 0 // M1
		}
		let bitSeq = []
		bitSeq = BitArr.concat(bitSeq, [BitArr.partial(3, symbol_num)])
		bitSeq = BitArr.concat(bitSeq, [BitArr.partial(2, mask_id)])
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
		formatStringVal = formatStringVal ^ 17477 //mask: 100010001000101
		formatString = [BitArr.partial(15, formatStringVal)]
		formatString = BitArr.toString(formatString)
		// console.log("FS",mask_id, this.version, formatString)
		return formatString
	}

	padCodewordToCapacity(buf, capacity){
		// Capacity in BYTES/Codewords
		let pad = 0x00
		let padBuffer = Buffer.alloc(1)
		padBuffer.writeUInt8(pad)
		while(buf.length < capacity){
			buf = Buffer.concat([buf, padBuffer])
		}
		return buf
	}

	static REQUIRED_VERSION(bitLength, ecc) {
		let ec_level = "LMQ".indexOf(ecc)
		let possibles = MicroQR.CHARACTERISTICS().map(x=>x[ec_level])
		let min = -1
		for (var i = 1; i < possibles.length; i++) {
			if(possibles[i]===undefined){continue}
			if(possibles[i].data_codewords*8 >= bitLength){
				min = i
				break
			}
		}
		if(min===-1){throw new Error("Data too large for all possible symbol sizes.")}
		// M1: Numeric only
		// M2: Numeric, Alphanumeric
		// M3: Numeric, Alphanumeric, Bytes, Kanji
		// M4: Numeric, Alphanumeric, Bytes, Kanji
		if(this.data_mode === "alphanumeric" && min === 1){min=2}
		if(this.data_mode === "bytes" && min < 3){min=3}
		if(this.data_mode === "kanji" && min < 3){min=3}
		return min
	}

	static DATA_MASKS(){
		return {
			"test" : {
				func: (x, y) => {return 0},
				id: 0
			},
			0 : {
				func: (x, y) => {return y%2==0},
				id: 0
			},
			1 : {
				func: (x, y) => {
					let a = Math.floor(y/2)
					let b = Math.floor(x/3)
					return (a+b)%2==0
				},
				id: 1
			},
			2 : {
				func: (x, y) => {
					let xy = x*y
					return ((xy%2)+(xy%3))%2==0
				},
				id: 2
			},
			3 : {
				func: (x, y) => {return ((((x+y)%2)+((x*y)%3))%2)==0},
				id: 3
			}
		}
	}

	static CHARACTERISTICS(){
		// Table 7 pg 41
		// table 9 pg 46
		return MICROQR_CHARACTERISTICS
	}
}

module.exports = MicroQR