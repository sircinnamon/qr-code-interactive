class TwoDArray {
	constructor(height, width, fill=undefined){
		this.height = height
		this.width = width
		this.fill = fill
		this.data = []
		for (let i = 0; i<height; i++){
			this.data.push(new Array())
			for (let j = 0; j<width; j++){
				this.data[i].push(fill)
			}
		}
	}

	get(x, y){
		return this.data[y][x]
	}

	set(x, y, val){
		if(x>=this.width || y>=this.height){return}
		this.data[y][x] = val
	}

	copy(originX, originY, arr){
		// 0,0 in arr will go to originX, originY in data
		for(let yoffset = 0; yoffset < arr.length; yoffset++){
			let y = originY + yoffset
			for(let xoffset = 0; xoffset < arr[yoffset].length; xoffset++){
				let x = originX + xoffset
				this.set(x,y,arr[yoffset][xoffset])
			}
		}
	}
}

module.exports = TwoDArray