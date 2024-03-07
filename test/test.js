let QR = require("../qr.js")
let assert = require("assert")
// let fs = require("fs")
let text = "CALL ME ISHMAEL. SOME YEARS AGO--NEVER MIND HOW LONG PRECISELY--HAVING LITTLE OR NO MONEY IN MY PURSE AND NOTHING PARTICULAR TO INTEREST ME ON SHORE I THOUGHT I WOULD SAIL ABOUT A LITTLE AND SEE THE WATERY PART OF THE WORLD. IT IS A WAY I HAVE OF DRIVING OFF THE SPLEEN AND REGULATING THE CIRCULATION. WHENEVER I FIND MYSELF GROWING GRIM ABOUT THE MOUTH. WHENEVER IT IS A DAMP DRIZZLY NOVEMBER IN MY SOUL. WHENEVER I FIND MYSELF INVOLUNTARILY PAUSING BEFORE COFFIN WAREHOUSES AND BRINGING UP THE REAR OF EVERY FUNERAL I MEET. AND ESPECIALLY WHENEVER MY HYPOS GET SUCH AN UPPER HAND OF ME THAT IT REQUIRES A STRONG MORAL PRINCIPLE TO PREVENT ME FROM DELIBERATELY STEPPING INTO THE STREET AND METHODICALLY KNOCKING PEOPLES HATS OFF--THEN I ACCOUNT IT HIGH TIME TO GET TO SEA AS SOON AS I CAN. THIS IS MY SUBSTITUTE FOR PISTOL AND BALL. WITH A PHILOSOPHICAL FLOURISH CATO THROWS HIMSELF UPON HIS SWORD. I QUIETLY TAKE TO THE SHIP. THERE IS NOTHING SURPRISING IN THIS. IF THEY BUT KNEW IT ALMOST ALL MEN IN THEIR DEGREE SOME TIME OR OTHER CHERISH VERY NEARLY THE SAME FEELINGS TOWARDS THE OCEAN WITH ME."


// console.log("============= TEST =============")
describe("Basic QR Build", () => {
	describe("Simple version 1", () => {
		it("Should build", () => {
			let qr = new QR(text.slice(0,10), {version: 1})
			assert.equal(qr.version, 1)
			assert.equal(qr.version, 1)
		})
	})
	describe("Simple version 40", () => {
		it("Should build", () => {
			let longtext = text+text+text+text
			let qr = new QR(longtext.slice(0,4296), {version: 40, ec_level: "L"})
			assert.equal(qr.version, 40)
		})
	})
	describe("Dimensions", () => {
		it("Should align with version", () => {
			let skip = 39
			for(i=1;i<=40;i+=skip){
				let qr = new QR(text.slice(10,0), {version: i})
				let expected_measure = i * 4 + 17
				assert.equal(qr.modules.data[0].length, expected_measure)
				assert.equal(qr.modules.height, expected_measure)
				assert.equal(qr.modules.width, expected_measure)
				assert.equal(qr.modules.data.length, expected_measure)
			}
		})
	})
	describe("Fixed patterns", () => {
		it("should have finder patterns", () => {
			let ver = 5
			let qr = new QR(text.slice(0,50), {version: ver})
			let finder = [
				[1,1,1,1,1,1,1],
				[1,0,0,0,0,0,1],
				[1,0,1,1,1,0,1],
				[1,0,1,1,1,0,1],
				[1,0,1,1,1,0,1],
				[1,0,0,0,0,0,1],
				[1,1,1,1,1,1,1]
			]
			let finder_pos = [
				[0,0],
				[0, qr.modules.width-7],
				[qr.modules.height-7, 0]
			]
			for(i=0;i<finder_pos.length;i++) {
				let pos = finder_pos[i]
				for (let y = finder.length - 1; y >= 0; y--) {
					for (let x = finder[0].length - 1; x >= 0; x--) {
						assert.equal(qr.modules.get(pos[1]+x,pos[0]+y), finder[y][x])
					}
				}
			}
		})
		it("should have alignment patterns", () => {
			let ver = 2
			let align_pos = [6,18] // Only valid for ver2
			let qr = new QR(text.slice(0,20), {version: ver})
			let alignment = [
				[1,1,1,1,1],
				[1,0,0,0,1],
				[1,0,1,0,1],
				[1,0,0,0,1],
				[1,1,1,1,1]
			]
			for(i=0;i<align_pos.length;i++) {
				for(j=0;j<align_pos.length;j++) {
					let pos = [align_pos[i], align_pos[j]]
					for (let y = alignment.length - 1; y >= 0; y--) {
						for (let x = alignment[0].length - 1; x >= 0; x--) {
							if(pos[1]<8){
								if(pos[0]<8){continue}
								if(pos[0]>qr.modules.height-8){continue}
							}
							if(pos[1]>qr.modules.width-8 && pos[0]<8){continue}
							assert.equal(qr.modules.get(pos[1]+x-2,pos[0]+y-2), alignment[y][x])
						}
					}
				}
			}
		})
		it("should have timing patterns", () => {
			let ver = 20
			let qr = new QR(text.slice(0,40), {version: ver})
			// vertical x=6
			for (let y = 7; y <= qr.modules.height-8; y++) {
				assert.equal(qr.modules.get(6,y), (y+1)%2)
			}
			// horizontal y=6
			for (let x = 7; x <= qr.modules.width-8; x++) {
				assert.equal(qr.modules.get(x,6), (x+1)%2)
			}
		})
		it("should have dark module", () => {
			let ver = 21
			let qr = new QR(text.slice(0,40), {version: ver})
			assert.equal(qr.modules.get(8, qr.modules.height-8), 1)
		})
		it("should have a correct Version Info string", () => {
			let ver = 7
			let expected_verinfo = "000111110010010100" // Change based on ver
			let qr = new QR(text.slice(0,40), {version: ver})

			let extracted_lower = ""
			let extracted_upper = ""
			let base = qr.measure - 11
			for (let i = 0; i < 18; i++) {
				let coord1 = Math.floor(i/3)
				let coord2 = base + (i%3)
				extracted_lower = qr.modules.get(coord1, coord2) + extracted_lower
				extracted_upper = qr.modules.get(coord2, coord1) + extracted_upper
			}
			assert.equal(expected_verinfo, extracted_lower)
			assert.equal(expected_verinfo, extracted_upper)
		})
		it("should have a correct format string", () => {
			let ver = 8
			// Change based on ver,data,mask, etc.
			// See generate format string test
			let expected_formatstring = "001100111010000"
			let qr = new QR(text.slice(0,40), {version: ver})
			let m = qr.measure-1
			let extracted_tl = [
				qr.modules.get(0, 8),
				qr.modules.get(1, 8),
				qr.modules.get(2, 8),
				qr.modules.get(3, 8),
				qr.modules.get(4, 8),
				qr.modules.get(5, 8),
				qr.modules.get(7, 8),
				qr.modules.get(8, 8),
				qr.modules.get(8, 7),
				qr.modules.get(8, 5),
				qr.modules.get(8, 4),
				qr.modules.get(8, 3),
				qr.modules.get(8, 2),
				qr.modules.get(8, 1),
				qr.modules.get(8, 0)
			].join("")
			let extracted_split = [
				qr.modules.get(8,m),
				qr.modules.get(8,m-1),
				qr.modules.get(8,m-2),
				qr.modules.get(8,m-3),
				qr.modules.get(8,m-4),
				qr.modules.get(8,m-5),
				qr.modules.get(8,m-6),
				qr.modules.get(m-7,8),
				qr.modules.get(m-6,8),
				qr.modules.get(m-5,8),
				qr.modules.get(m-4,8),
				qr.modules.get(m-3,8),
				qr.modules.get(m-2,8),
				qr.modules.get(m-1,8),
				qr.modules.get(m,8)
			].join("")

			assert.equal(extracted_tl, expected_formatstring)
			assert.equal(extracted_split, expected_formatstring)
		})
	})
})
// qr_test = new QR(text, {version:40})
// console.log(qr_test.toTerminalString())
// fs.writeFileSync("./svgs/test.svg", qr_test.toSVG(10))