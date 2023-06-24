class QRScorer {
	static score(modules){
		// console.log(modules)
		return QRScorer.rule1(modules)+QRScorer.rule2(modules)+QRScorer.rule3(modules)+QRScorer.rule4(modules)
	}

	static rule1(modules){
		// Horizontal and vertical streaks
		// streak of 5 = +3 score, 6->+4, 7->+5 etc
		let h_score = 0
		for (let i = modules.data.length - 1; i >= 0; i--) {
			let row = modules.data[i].join("")+" "
			let groups = row.match(/(0+(?=[1 ]))|(1+(?=[0 ]))/g)
			groups = groups.filter(x=>x.length>4)
			let row_score = groups.reduce((acc, x) =>acc+(x.length-2), 0)
			h_score += row_score
		}
		let v_score = 0
		for (let i = modules.data.length - 1; i >= 0; i--) {
			let col = modules.data.map(x=>x[i]).join("")+" "
			let groups = col.match(/(0+(?=[1 ]))|(1+(?=[0 ]))/g)
			groups = groups.filter(x=>x.length>4)
			let col_score = groups.reduce((acc, x) =>acc+(x.length-2), 0)
			v_score += col_score
		}
		// console.log("rule 1 "+(h_score+v_score))
		return h_score+v_score
	}

	static rule2(modules){
		// 2x2 squares
		let score = 0
		for (let i = modules.data.length - 2; i >= 0; i--) {
			for (let j = modules.data.length - 2; j >= 0; j--) {
				let [sq1, sq2, sq3, sq4] = [
						modules.get(i, j),
						modules.get(i+1, j),
						modules.get(i, j+1),
						modules.get(i+1, j+1)
					]
					if(sq1==sq2 && sq2==sq3 && sq3==sq4){
						score+=3
					}
			}
		}
		// console.log("rule 2 "+score)
		return score
	}

	static rule3(modules){
		// Fake finder patterns
		let search1 = /10111010000/g
		let search2 = /00001011101/g
		let h_score = 0
		for (let i = modules.data.length - 1; i >= 0; i--) {
			let row = modules.data[i].join("")
			let groups1 = row.match(search1) || []
			let groups2 = row.match(search2) || []
			let row_score = (groups1.length + groups2.length)*40
			h_score += row_score
		}
		let v_score = 0
		for (let i = modules.data.length - 1; i >= 0; i--) {
			let col = modules.data.map(x=>x[i]).join("")
			let groups1 = col.match(search1) || []
			let groups2 = col.match(search2) || []
			let col_score = (groups1.length + groups2.length)*40
			v_score += col_score
		}
		// console.log("rule 3 "+(h_score+v_score))
		return h_score+v_score
	}

	static rule4(modules){
		let dark = modules.data.reduce((acc, curr)=>{
			return acc+=curr.reduce((rowacc, val)=>rowacc+=val, 0)
		}, 0)
		let total = modules.data.length * modules.data.length
		let ratio_low = Math.floor((dark/total)*20)*5
		let diff_low = Math.abs(50-ratio_low)
		let ratio_hi = Math.ceil((dark/total)*20)*5
		let diff_hi = Math.abs(50-ratio_hi)
		// console.log("rule 4 "+Math.min(diff_low, diff_hi)*2)
		return Math.min(diff_low, diff_hi)*2
	}
}

module.exports = QRScorer