class MicroQRScorer {
	static score(modules){
		// console.log(modules)
		return MicroQRScorer.rule1(modules)
	}

	static rule1(modules){
		// Dark modules along edge
		let sum1 = [...modules.data[modules.height-1]]
		let sum2 = modules.data.map(m=>m[modules.width-1])
		sum1 = sum1.reduce((acc, curr)=>acc+curr, 0)
		sum2 = sum2.reduce((acc, curr)=>acc+curr, 0)
		return (Math.max(sum1, sum2)*16) + Math.min(sum1, sum2)
	}

}

module.exports = MicroQRScorer