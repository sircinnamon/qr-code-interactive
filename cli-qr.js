let QR = require("./qr.js")
let fs = require("fs")
const { program, Option } = require("commander")

program
	.name("cli-qr")
	.description("CLI program to generate generic QR codes to SVG or terminal")
	.argument("<string>", "Value to encode (numeric, string, binary, or kanji)")
	.option("-o, --output <string>", "File to save svg output", undefined)
	.addOption(
		new Option(
			"-d, --data-mode <string>",
			"Force data mode"
		)
		.default(undefined, "Match to content")
		.choices(["numeric","alphanumeric","kanji","bytes"])
	)
	.addOption(
		new Option(
			"-s, --size <number>",
			"QR Code size [1-40]"
		)
		.default(undefined, "Fit content")
		.choices(Array.from(Array(41).keys()).map(x=>""+x))
	)
	.addOption(
		new Option(
			"-e, --error-correction <char>",
			"Error correction level"
		)
		.default("H", "High")
		.choices(["M","C","H","Q"])
	)
	.addOption(
		new Option(
			"--unsafe-mask <number>",
			"UNSAFE: Override 'best-mask' and use predetermined data mask [0-7]"
		)
		.default(undefined)
		.choices([1,2,3,4,5,6,7].map(x=>""+x))
	)
	.action((input, options) => {
		// console.log(input, options)
		if(options.type === "numeric"){input = parseInt(input)}
		let qr = new QR(input, {
			version: parseInt(options.size),
			mode: options.dataMode,
			ec_level: options.errorCorrection,
			unsafe_mask: parseInt(options.unsafeMask) || undefined
		})
		if(options.output===undefined){
			console.log(qr.toTerminalString())
		} else {
			fs.writeFileSync(options.output, qr.toSVG(10))
		}
	}) 

program.parse()