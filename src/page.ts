import * as THREE from "three";
import {
	approach,
	cosineInterpolate,
	vectorToRadians,
	lerp,
	clamp,
} from "./util";

const headlineFillImage = new Image();
headlineFillImage.src = "/img/pages/abstract-people.webp";
const heartImage = new Image();
heartImage.src = "/img/pages/heart.png";
const pageOneImage = new Image();
pageOneImage.src = "/img/pages/untitled1-page-1.png";
const backgroundImage = new Image();
backgroundImage.crossOrigin = "anonymous";
backgroundImage.src =
	"https://cdn.builder.io/api/v1/image/assets%2F642fe6953ac445aa94caa185de9acd75%2F8ea28b056659491dbc62979e1590a30f?format=webp&width=800&height=1200";

const pageFiveImage = new Image();
pageFiveImage.crossOrigin = "anonymous";
pageFiveImage.src =
	"https://cdn.builder.io/api/v1/image/assets%2F642fe6953ac445aa94caa185de9acd75%2F9d3cf29183cc43fc9adbda149c0942bc?format=webp&width=800&height=1200";

const pageSixImage = new Image();
pageSixImage.crossOrigin = "anonymous";
pageSixImage.src =
	"https://cdn.builder.io/api/v1/image/assets%2F642fe6953ac445aa94caa185de9acd75%2F27179800f25e48bcb0940ef442613938?format=webp&width=800&height=1200";

const pageSevenImage = new Image();
pageSevenImage.crossOrigin = "anonymous";
pageSevenImage.src =
	"https://cdn.builder.io/api/v1/image/assets%2F642fe6953ac445aa94caa185de9acd75%2F98e0e4a6976c4fa5874d466a9d542d6f?format=webp&width=800&height=1200";

const pageEightImage = new Image();
pageEightImage.crossOrigin = "anonymous";
pageEightImage.src =
	"https://cdn.builder.io/api/v1/image/assets%2F642fe6953ac445aa94caa185de9acd75%2F3958a2342bbe44159b3899471fc500b7?format=webp&width=800&height=1200";

const contentsImage = new Image();
contentsImage.crossOrigin = "anonymous";
contentsImage.src =
	"https://cdn.builder.io/api/v1/image/assets%2F642fe6953ac445aa94caa185de9acd75%2Fddead068c1d24da19e0540ce4242d29c?format=webp&width=800&height=1200";

export default class Page {
	public textureUrls;
	public width: number;
	public height: number;
	public thickness: number;
	public rootThickness: number;
	public elevationLeft = 0;
	public elevationRight = 0;
	public baseElevation = 30;
	public isCover = false;
	public edgeColor = 0xffffff;

	public mesh: THREE.Mesh;
	public pivot: THREE.Group;

	public turnProgress: number = 0;
	public turnProgressLag: number = 0;
	private xSegments = 1;
	private ySegments = 1;
	private zSegments = 20;
	private vertexRelCoords: THREE.Vector3[] = [];
	public bendingEnabled: boolean = true;
	private textureLoader: THREE.TextureLoader;
	private isFrontCover: boolean;
	private frontPageNumber: number | null;
	private backPageNumber: number | null;
	private hasTurnProgressUpdated = false;
	private static paperTexture: THREE.CanvasTexture | null = null;

	private getPaperTexture() {
		if (Page.paperTexture) return Page.paperTexture;

		const canvas = document.createElement("canvas");
		canvas.width = 256;
		canvas.height = 256;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, 256, 256);

			const image = ctx.getImageData(0, 0, 256, 256);
			for (let i = 0; i < image.data.length; i += 4) {
				const shade = 232 + Math.random() * 23;
				image.data[i] = shade;
				image.data[i + 1] = shade;
				image.data[i + 2] = shade;
			}
			ctx.putImageData(image, 0, 0);

			ctx.strokeStyle = "rgba(120, 95, 60, 0.05)";
			ctx.lineWidth = 1;
			for (let i = 0; i < 160; i++) {
				const x = Math.random() * 256;
				const y = Math.random() * 256;
				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.lineTo(
					x + Math.random() * 24 - 12,
					y + Math.random() * 3 - 1.5,
				);
				ctx.stroke();
			}
		}

		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set(1, 4);
		Page.paperTexture = texture;
		return texture;
	}

	private drawMountainShadow(ctx: CanvasRenderingContext2D, w: number, h: number, pageOffset: number) {
		const x1 = w * 0.05;
		const y1 = h * 0.76;
		const x2 = w * 2;
		const steps = 160;
		ctx.save();
		ctx.translate(-pageOffset, 0);
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(0, y1);
		ctx.lineTo(x1, y1);
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;
			const x = x1 + t * (x2 - x1);
			const baseY = y1 * (1 - t);
			const wave = h * 0.035 * Math.sin(t * Math.PI * 4) + h * 0.015 * Math.sin(t * Math.PI * 11 + 1);
			const peak = h * 0.03 * Math.abs(Math.sin(t * Math.PI * 7));
			ctx.lineTo(x, Math.max(0, baseY + wave - peak));
		}
		ctx.lineTo(x2, 0);
		ctx.closePath();
		ctx.fillStyle = "#000000";
		ctx.fill();
		ctx.restore();
	}

	private drawHeadline(
		ctx: CanvasRenderingContext2D,
		text: string,
		w: number,
		h: number,
		baselineRatio: number,
		gap: string | CanvasPattern | null = null,
	) {
		let fontSize = Math.round(h * 0.28);
		ctx.font = `400 ${fontSize}px Georgia, "Times New Roman", serif`;
		const measured = ctx.measureText(text).width;
		const maxWidth = w * 0.9;
		if (measured > maxWidth) {
			fontSize = Math.floor((fontSize * maxWidth) / measured);
			ctx.font = `400 ${fontSize}px Georgia, "Times New Roman", serif`;
		}
		ctx.fillStyle = gap ? "#ffffff" : "#1f2a33";
		ctx.textAlign = "left";
		ctx.textBaseline = "alphabetic";
		ctx.fillText(text, w * 0.05, h * baselineRatio);
		if (gap) {
			ctx.lineWidth = fontSize * 0.07;
			ctx.strokeStyle = "#1f2a33";
			ctx.strokeText(text, w * 0.05, h * baselineRatio);
			ctx.lineWidth = fontSize * 0.045;
			ctx.strokeStyle = gap;
			ctx.strokeText(text, w * 0.05, h * baselineRatio);
		}
	}

	private decoratePageTexture(
		texture: THREE.Texture,
		pageNumber: number | null,
		isBack: boolean,
	) {
		const image = texture.image as
			| HTMLImageElement
			| HTMLCanvasElement
			| undefined;
		if (!image || !image.width || !image.height) return;

		const canvas = document.createElement("canvas");
		canvas.width = image.width;
		canvas.height = image.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		if (pageNumber === 1 || pageNumber === 2) {
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			if (pageNumber === 1) {
				if (!pageOneImage.complete || !pageOneImage.naturalWidth) {
					pageOneImage.addEventListener(
						"load",
						() => this.decoratePageTexture(texture, pageNumber, isBack),
						{ once: true },
					);
					return;
				}
				const scale = Math.max(
					canvas.width / pageOneImage.naturalWidth,
					canvas.height / pageOneImage.naturalHeight,
				);
				const dw = pageOneImage.naturalWidth * scale;
				const dh = pageOneImage.naturalHeight * scale;
				ctx.drawImage(
					pageOneImage,
					(canvas.width - dw) / 2,
					(canvas.height - dh) / 2,
					dw,
					dh,
				);
			} else {
				if (!headlineFillImage.complete || !heartImage.complete) {
					const retry = () => {
						if (headlineFillImage.complete && heartImage.complete) this.decoratePageTexture(texture, pageNumber, isBack);
					};
					headlineFillImage.addEventListener("load", retry);
					heartImage.addEventListener("load", retry);
					return;
				}
				const fillCanvas = document.createElement("canvas");
				fillCanvas.width = canvas.width;
				fillCanvas.height = canvas.height;
				const fillCtx = fillCanvas.getContext("2d");
				if (!fillCtx) return;
				const scale = Math.max(canvas.width / headlineFillImage.width, canvas.height / headlineFillImage.height);
				const dw = headlineFillImage.width * scale;
				const dh = headlineFillImage.height * scale;
				fillCtx.drawImage(headlineFillImage, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
				const gapPattern = ctx.createPattern(fillCanvas, "no-repeat");
				if (!gapPattern) return;
				this.drawHeadline(ctx, "l", canvas.width, canvas.height, 0.79, gapPattern);
				const oWidth = ctx.measureText("o").width;
				const heartWidth = oWidth * 1.1;
				const heartHeight = heartWidth * (heartImage.height / heartImage.width);
				const cx = canvas.width * 0.05 + ctx.measureText("l").width + oWidth / 2;
				const cy = canvas.height * 0.79 - canvas.height * 0.07;
				ctx.globalCompositeOperation = "multiply";
				ctx.drawImage(heartImage, cx - heartWidth / 2, cy - heartHeight / 2, heartWidth, heartHeight);
				ctx.globalCompositeOperation = "source-over";
				this.drawHeadline(ctx, "ve", canvas.width, canvas.height, 0.97, gapPattern);
				this.drawMountainShadow(ctx, canvas.width, canvas.height, canvas.width);
			}
		} else if (pageNumber === 3) {
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			if (contentsImage.complete && contentsImage.naturalWidth > 0) {
				const scale = Math.max(
					canvas.width / contentsImage.naturalWidth,
					canvas.height / contentsImage.naturalHeight,
				);
				const dw = contentsImage.naturalWidth * scale;
				const dh = contentsImage.naturalHeight * scale;
				ctx.drawImage(
					contentsImage,
					(canvas.width - dw) / 2,
					(canvas.height - dh) / 2,
					dw,
					dh,
				);
			} else {
				contentsImage.addEventListener(
					"load",
					() => this.decoratePageTexture(texture, pageNumber, isBack),
					{ once: true },
				);
			}
		} else if (pageNumber === 4) {
			if (backgroundImage.complete && backgroundImage.naturalWidth > 0) {
				const scale = Math.max(canvas.width / backgroundImage.naturalWidth, canvas.height / backgroundImage.naturalHeight);
				const dw = backgroundImage.naturalWidth * scale;
				const dh = backgroundImage.naturalHeight * scale;
				ctx.drawImage(backgroundImage, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
			} else {
				backgroundImage.addEventListener(
					"load",
					() => this.decoratePageTexture(texture, pageNumber, isBack),
					{ once: true },
				);
			}
		} else if (pageNumber === 6) {
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			if (pageSixImage.complete && pageSixImage.naturalWidth > 0) {
				const scale = Math.max(canvas.width / pageSixImage.naturalWidth, canvas.height / pageSixImage.naturalHeight);
				const dw = pageSixImage.naturalWidth * scale;
				const dh = pageSixImage.naturalHeight * scale;
				ctx.drawImage(pageSixImage, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
			} else {
				pageSixImage.addEventListener(
					"load",
					() => this.decoratePageTexture(texture, pageNumber, isBack),
					{ once: true },
				);
			}
		} else if (pageNumber === 5) {
				ctx.fillStyle = "#ffffff";
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				if (pageFiveImage.complete && pageFiveImage.naturalWidth > 0) {
					const scale = Math.max(canvas.width / pageFiveImage.naturalWidth, canvas.height / pageFiveImage.naturalHeight);
					const dw = pageFiveImage.naturalWidth * scale;
					const dh = pageFiveImage.naturalHeight * scale;
					ctx.drawImage(pageFiveImage, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
				} else {
					pageFiveImage.addEventListener(
						"load",
						() => this.decoratePageTexture(texture, pageNumber, isBack),
						{ once: true },
					);
				}
		} else if (pageNumber === 7) {
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			if (pageSevenImage.complete && pageSevenImage.naturalWidth > 0) {
				const scale = Math.max(canvas.width / pageSevenImage.naturalWidth, canvas.height / pageSevenImage.naturalHeight);
				const dw = pageSevenImage.naturalWidth * scale;
				const dh = pageSevenImage.naturalHeight * scale;
				ctx.drawImage(pageSevenImage, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
			} else {
				pageSevenImage.addEventListener(
					"load",
					() => this.decoratePageTexture(texture, pageNumber, isBack),
					{ once: true },
				);
			}
		} else if (pageNumber === 8) {
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			if (pageEightImage.complete && pageEightImage.naturalWidth > 0) {
				const scale = Math.max(canvas.width / pageEightImage.naturalWidth, canvas.height / pageEightImage.naturalHeight);
				const dw = pageEightImage.naturalWidth * scale;
				const dh = pageEightImage.naturalHeight * scale;
				ctx.drawImage(pageEightImage, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
			} else {
				pageEightImage.addEventListener(
					"load",
					() => this.decoratePageTexture(texture, pageNumber, isBack),
					{ once: true },
				);
			}
		} else {
			ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
		}

		const w = canvas.width;
		const h = canvas.height;
		const radius = clamp(Math.min(w, h) * 0.05, 45, 70);

		// Round the top-right and bottom-right corners. The alpha cutout is
		// part of the page texture, so it bends with the paper.
		const edgeX = isBack ? 0 : w;
		const insetX = isBack ? radius : w - radius;
		ctx.globalCompositeOperation = "destination-out";
		ctx.beginPath();
		ctx.moveTo(insetX, 0);
		ctx.lineTo(edgeX, 0);
		ctx.lineTo(edgeX, radius);
		ctx.quadraticCurveTo(edgeX, 0, insetX, 0);
		ctx.closePath();
		ctx.fill();

		ctx.beginPath();
		ctx.moveTo(edgeX, h - radius);
		ctx.lineTo(edgeX, h);
		ctx.lineTo(insetX, h);
		ctx.quadraticCurveTo(edgeX, h, edgeX, h - radius);
		ctx.closePath();
		ctx.fill();
		ctx.globalCompositeOperation = "source-over";

		if (pageNumber !== null && pageNumber !== 3 && pageNumber !== 4 && pageNumber !== 5 && pageNumber !== 6 && pageNumber !== 7 && pageNumber !== 8) {
			const fontSize = Math.max(18, Math.round(h * 0.026));
			ctx.font = `600 ${fontSize}px Arial, sans-serif`;
			ctx.textAlign = "right";
			ctx.textBaseline = "bottom";
			const x = w - radius * 1.8;
			const y = h - radius * 1.3;
			const label = String(pageNumber);

			ctx.lineWidth = Math.max(2, fontSize * 0.12);
			ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
			ctx.strokeText(label, x, y);
			ctx.fillStyle = "rgba(20, 20, 20, 0.8)";
			ctx.fillText(label, x, y);
		}

		texture.image = canvas;
		texture.needsUpdate = true;
	}

	constructor(pageParams: PageParams) {
		this.textureUrls = pageParams.textureUrls;
		this.width = pageParams.width;
		this.height = pageParams.height;
		this.thickness = pageParams.thickness || 2;
		this.rootThickness = pageParams.rootThickness || 4;
		this.isCover = !!pageParams.isCover;
		this.edgeColor = pageParams.edgeColor || 0xffffff;
		this.textureLoader = pageParams.textureLoader;
		this.isFrontCover = pageParams.isFrontCover;
		this.frontPageNumber = pageParams.frontPageNumber ?? null;
		this.backPageNumber = pageParams.backPageNumber ?? null;

		if (this.isCover) {
			this.zSegments = 1;
		}

		// Load front and back textures
		const _texture = (url: string, pageNumber?: number | null, isBack = false) => {
			const isPageFace = typeof pageNumber !== "undefined";
			const texture = this.textureLoader.load(url, loaded =>
				isPageFace
					? this.decoratePageTexture(loaded, pageNumber ?? null, isBack)
					: undefined,
			);
			texture.colorSpace = THREE.SRGBColorSpace;
			texture.minFilter = THREE.LinearFilter;
			texture.generateMipmaps = false;
			// texture.anisotropy = 16;
			return {
				map: texture,
				vertexColors: !this.isCover,
				alphaTest: isPageFace ? 0.5 : 0,
			};
		};
		const _color = (hex: number) => ({
			color: new THREE.Color(hex),
			map: this.isCover ? undefined : this.getPaperTexture(),
		});

		const textures: Record<
			string,
			{ map?: THREE.Texture; color?: THREE.Color; alphaTest?: number }
		> = {
			front: _texture(this.textureUrls.front, this.frontPageNumber),
			back: _texture(this.textureUrls.back, this.backPageNumber, true),
			edgeTop: _color(this.edgeColor),
			edgeBottom: _color(this.edgeColor),
			edgeLeft: _color(this.edgeColor),
			edgeRight: _color(this.edgeColor),
		};

		if (this.textureUrls.edgeTB) {
			textures.edgeTop = _texture(this.textureUrls.edgeTB);
			textures.edgeBottom = _texture(this.textureUrls.edgeTB);
		}
		if (this.textureUrls.edgeLR) {
			textures.edgeLeft = _texture(this.textureUrls.edgeLR);
			textures.edgeRight = _texture(this.textureUrls.edgeLR);
		}

		const materials = [
			new THREE.MeshStandardMaterial(textures.back),
			new THREE.MeshStandardMaterial(textures.front),
			new THREE.MeshStandardMaterial(textures.edgeTop),
			new THREE.MeshStandardMaterial(textures.edgeBottom),
			new THREE.MeshStandardMaterial(textures.edgeRight),
			new THREE.MeshStandardMaterial(textures.edgeLeft),
		];

		const geometry = new THREE.BoxGeometry(
			this.thickness,
			this.height,
			this.width,
			this.xSegments,
			this.ySegments,
			this.zSegments,
		);

		this.mesh = new THREE.Mesh(geometry, materials);
		this.mesh.receiveShadow = true;
		this.mesh.castShadow = true;
		// this.mesh = new THREE.Mesh(
		// 	geometry,
		// 	new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true }),
		// );

		this.pivot = new THREE.Group();
		this.pivot.add(this.mesh);

		const position = geometry.attributes.position;
		const uv = geometry.attributes.uv;

		const colors = new Float32Array(position.count * 3);

		for (let i = 0; i < position.count; i++) {
			const coord = new THREE.Vector3(
				position.getX(i) / this.thickness + 0.5,
				position.getY(i) / this.height + 0.5,
				position.getZ(i) / this.width + 0.5,
			);

			if (!this.isCover) {
				// increase vertex density closer to the spine for better bending
				coord.z = cosineInterpolate(0, 2, coord.z / 2);
				uv.setXY(i, coord.x > 0.5 ? 1 - coord.z : coord.z, coord.y);
			}

			this.vertexRelCoords[i] = coord;

			// apply artificial ambient occlusion using vertex colors
			const darken = clamp((1 - coord.z) ** 4 - 0.6, 0, 1);
			colors[i * 3] = 1 - darken; // Red channel
			colors[i * 3 + 1] = 1 - darken; // Green channel
			colors[i * 3 + 2] = 1 - darken; // Blue channel
		}

		// Add the colors attribute to the geometry
		geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

		uv.needsUpdate = true;
	}

	public getCurve() {
		if (this.isCover) {
			const backShift = this.rootThickness;
			const leftShift =
				(this.rootThickness / 2) * (this.isFrontCover ? 1 : -1);
			const angle = (-this.turnProgress + 1) * (Math.PI / 2);

			const direction = new THREE.Vector2(
				Math.cos(angle),
				Math.sin(angle),
			);

			const perpendicular = new THREE.Vector2(-direction.y, direction.x);

			const p0 = new THREE.Vector2()
				.addScaledVector(direction, -backShift)
				.addScaledVector(perpendicular, leftShift);

			const p2 = new THREE.Vector2()
				.addScaledVector(direction, this.width - backShift)
				.addScaledVector(perpendicular, leftShift);

			const p1 = new THREE.Vector2()
				.addVectors(p0, p2)
				.multiplyScalar(0.5);

			return new THREE.QuadraticBezierCurve(p0, p1, p2);
		} else {
			const piProgress = Math.abs(this.turnProgress) * (Math.PI / 2);
			const eFactorSin = Math.sin(piProgress);
			const eFactorCos = -Math.cos(piProgress) + 1;

			const isRight = this.turnProgress > 0;
			const maxHeight = isRight
				? this.elevationRight
				: this.elevationLeft;

			// elevation of the second control point
			const p2baseElevation = this.baseElevation;
			const p2elev = eFactorSin * (maxHeight + p2baseElevation) * 2;
			// elevation of the 3rd and the 4th control points
			const p34elev = eFactorCos * maxHeight;

			// calculates positions for the 3rd and the 4th control points
			const calcP34 = (tp: number, dist: number) =>
				new THREE.Vector2(
					Math.sin(tp * (Math.PI / 2)) * dist,
					Math.cos(tp * (Math.PI / 2)) * dist + p34elev,
				);

			const p0 = new THREE.Vector2();
			const p1 = new THREE.Vector2(0, p2elev);
			const p2 = calcP34(this.turnProgress, this.width * 0.5);
			const p3 = calcP34(this.turnProgressLag, this.width);

			return new THREE.CubicBezierCurve(p0, p1, p2, p3);
		}
	}

	public update(dt: number) {
		// straighten
		let straightenTarget = this.turnProgress;
		if (this.bendingEnabled) {
			// gravity bend
			straightenTarget = clamp(straightenTarget * 1.1, -1, 1);
		}
		this.turnProgressLag = approach(
			this.turnProgressLag,
			straightenTarget,
			this.bendingEnabled ? 5 : 25,
			dt,
		);

		const curve = this.getCurve();
		const curveStretch = Math.max(curve.getLength() / this.width, 1);

		const position = this.mesh.geometry.attributes.position;
		for (let i = 0; i < position.count; i++) {
			const relCoord = this.vertexRelCoords[i];

			// const pos = curve.getPoint(relCoord.z * (1 / curveStretch));
			const pos = curve.getPointAt(relCoord.z * (1 / curveStretch));

			// TODO: get direction from previous point?
			// const direction =
			// 	vectorToRadians(curve.getTangent(relCoord.z)) + Math.PI / 2;
			const direction =
				vectorToRadians(curve.getTangentAt(relCoord.z)) + Math.PI / 2;

			const thickness = lerp(
				this.rootThickness,
				this.thickness,
				relCoord.z,
			);

			const sign = -Math.sign(relCoord.x - 0.5);
			const newX = pos.x + Math.cos(direction) * (thickness / 2) * sign;
			const newZ = pos.y + Math.sin(direction) * (thickness / 2) * sign;
			position.setX(i, newX);
			position.setZ(i, newZ);
		}

		position.needsUpdate = true;
		// TODO: calculate normals manually?
		this.mesh.geometry.computeVertexNormals();
		this.mesh.geometry.computeBoundingSphere();

		this.hasTurnProgressUpdated = true;
	}

	public needsUpdate() {
		if (!this.hasTurnProgressUpdated) return true;
		return (
			(this.turnProgress !== 1 &&
				this.turnProgress !== -1 &&
				this.turnProgress !== 0) ||
			this.turnProgress !== this.turnProgressLag
		);
	}

	public setTurnProgress(turnProgress: number) {
		if (turnProgress === this.turnProgress) return;

		if (!this.bendingEnabled) {
			const delta = turnProgress - this.turnProgress;
			this.turnProgressLag += delta;
		}

		this.turnProgress = turnProgress;
		this.hasTurnProgressUpdated = false;
	}

	public setElevation(elevationLeft: number, elevationRight: number) {
		if (this.isCover) return;
		this.elevationLeft = elevationLeft;
		this.elevationRight = elevationRight;
	}

	public getElevation() {
		const turnProgress = this.turnProgress + 1 / 2;
		return lerp(this.elevationLeft, this.elevationRight, turnProgress);
	}

	public getPageAreaCorners(area: PageArea, backside = false) {
		const top = area.top;
		const bottom = area.top + area.height;
		let left = area.left;
		let right = area.left + area.width;
		if (backside) [left, right] = [1 - left, 1 - right];

		const curve = this.getCurve();
		const curveStretch = Math.max(curve.getLength() / this.width, 1);
		const unstretch = 1 / curveStretch;

		const [lx, lz] = curve.getPointAt(left * unstretch);
		const [rx, rz] = curve.getPointAt(right * unstretch);

		const ty = (top - 0.5) * -this.height;
		const by = (bottom - 0.5) * -this.height;

		const cornerTL = new THREE.Vector3(lx, ty, lz);
		const cornerTR = new THREE.Vector3(rx, ty, rz);
		const cornerBL = new THREE.Vector3(lx, by, lz);
		const cornerBR = new THREE.Vector3(rx, by, rz);

		// Transform corners to global space
		this.pivot.localToWorld(cornerTL);
		this.pivot.localToWorld(cornerTR);
		this.pivot.localToWorld(cornerBL);
		this.pivot.localToWorld(cornerBR);

		return [cornerTL, cornerTR, cornerBL, cornerBR];
	}
}
