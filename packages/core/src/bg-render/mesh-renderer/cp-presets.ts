interface ControlPointConf {
	cx: number;
	cy: number;
	x: number;
	y: number;
	ur: number;
	vr: number;
	up: number;
	vp: number;
}

interface ControlPointPreset {
	width: number;
	height: number;
	conf: ControlPointConf[];
}

const p = (
	cx: number,
	cy: number,
	x: number,
	y: number,
	ur = 0,
	vr = 0,
	up = 1,
	vp = 1,
) => Object.freeze({ cx, cy, x, y, ur, vr, up, vp }) as ControlPointConf;
const preset = (width: number, height: number, conf: ControlPointConf[]) =>
	Object.freeze({ width, height, conf }) as ControlPointPreset;

export const CONTROL_POINT_PRESETS = [
	// TODO: 竖屏推荐
	preset(5, 5, [
		p(0, 0, -1, -1, 0, 0, 1, 1),
		p(1, 0, -0.5, -1, 0, 0, 1, 1),
		p(2, 0, 0, -1, 0, 0, 1, 1),
		p(3, 0, 0.5, -1, 0, 0, 1, 1),
		p(4, 0, 1, -1, 0, 0, 1, 1),
		p(0, 1, -1, -0.5, 0, 0, 1, 1),
		p(1, 1, -0.5, -0.5, 0, 0, 1, 1),
		p(2, 1, -0.0052029684413368305, -0.6131420587090777, 0, 0, 1, 1),
		p(3, 1, 0.5884227308309977, -0.3990805107556692, 0, 0, 1, 1),
		p(4, 1, 1, -0.5, 0, 0, 1, 1),
		p(0, 2, -1, 0, 0, 0, 1, 1),
		p(1, 2, -0.4210024670505933, -0.11895058380429502, 0, 0, 1, 1),
		p(2, 2, -0.1019613423315412, -0.023812118047224606, 0, -47, 0.629, 0.849),
		p(3, 2, 0.40275125660925437, -0.06345314544600389, 0, 0, 1, 1),
		p(4, 2, 1, 0, 0, 0, 1, 1),
		p(0, 3, -1, 0.5, 0, 0, 1, 1),
		p(1, 3, 0.06801958477287173, 0.5205913248960121, -31, -45, 1, 1),
		p(2, 3, 0.21446469120128908, 0.29331610114301043, 6, -56, 0.566, 1.321),
		p(3, 3, 0.5, 0.5, 0, 0, 1, 1),
		p(4, 3, 1, 0.5, 0, 0, 1, 1),
		p(0, 4, -1, 1, 0, 0, 1, 1),
		p(1, 4, -0.31378372841550195, 1, 0, 0, 1, 1),
		p(2, 4, 0.26153633255328046, 1, 0, 0, 1, 1),
		p(3, 4, 0.5, 1, 0, 0, 1, 1),
		p(4, 4, 1, 1, 0, 0, 1, 1),
	]),
	// TODO: 横屏推荐
	preset(4, 4, [
		p(0, 0, -1, -1, 0, 0, 1, 1),
		p(1, 0, -0.33333333333333337, -1, 0, 0, 1, 1),
		p(2, 0, 0.33333333333333326, -1, 0, 0, 1, 1),
		p(3, 0, 1, -1, 0, 0, 1, 1),
		p(0, 1, -1, -0.04495399932657351, 0, 0, 1, 1),
		p(1, 1, -0.24056117520129328, -0.22465999020104, 0, 0, 1, 1),
		p(2, 1, 0.334758885767489, -0.00531297192779423, 0, 0, 1, 1),
		p(3, 1, 0.9989920470678106, -0.3382976020775408, 8, 0, 0.566, 1.792),
		p(0, 2, -1, 0.33333333333333326, 0, 0, 1, 1),
		p(1, 2, -0.3425497314639411, -0.000027501607956947893, 0, 0, 1, 1),
		p(2, 2, 0.3321437945812673, 0.1981776353859399, 0, 0, 1, 1),
		p(3, 2, 1, 0.0766118180296832, 0, 0, 1, 1),
		p(0, 3, -1, 1, 0, 0, 1, 1),
		p(1, 3, -0.33333333333333337, 1, 0, 0, 1, 1),
		p(2, 3, 0.33333333333333326, 1, 0, 0, 1, 1),
		p(3, 3, 1, 1, 0, 0, 1, 1),
	]),
	preset(4, 4, [
		p(0, 0, -1, -1, 0, 0, 1, 2.075),
		p(1, 0, -0.33333333333333337, -1, 0, 0, 1, 1),
		p(2, 0, 0.33333333333333326, -1, 0, 0, 1, 1),
		p(3, 0, 1, -1, 0, 0, 1, 1),
		p(0, 1, -1, -0.4545779491139603, 0, 0, 1, 1),
		p(1, 1, -0.33333333333333337, -0.33333333333333337, 0, 0, 1, 1),
		p(2, 1, 0.0889403142626457, -0.6025711180694033, -32, 45, 1, 1),
		p(3, 1, 1, -0.33333333333333337, 0, 0, 1, 1),
		p(0, 2, -1, -0.07402408608567845, 1, 0, 1, 0.094),
		p(1, 2, -0.2719422694359541, 0.09775369930903222, 25, -18, 1.321, 0),
		p(2, 2, 0.19877414408395877, 0.4307383294587789, 48, -40, 0.755, 0.975),
		p(3, 2, 1, 0.33333333333333326, -37, 0, 1, 1),
		p(0, 3, -1, 1, 0, 0, 1, 1),
		p(1, 3, -0.33333333333333337, 1, 0, 0, 1, 1),
		p(2, 3, 0.5125850864305672, 1, -20, -18, 0, 1.604),
		p(3, 3, 1, 1, 0, 0, 1, 1),
	]),
	preset(5, 5, [
		p(0, 0, -1, -1, 0, 0, 1, 1),
		p(1, 0, -0.4501953125, -1, 0, 55, 1, 2.075),
		p(2, 0, 0.1953125, -1, 0, 0, 1, 1),
		p(3, 0, 0.4580078125, -1, 0, -25, 1, 1),
		p(4, 0, 1, -1, 0, 0, 1, 1),
		p(0, 1, -1, -0.2514475377525607, -16, 0, 2.327, 0.943),
		p(1, 1, -0.55859375, -0.6609325945787148, 47, 0, 2.358, 0.377),
		p(2, 1, 0.232421875, -0.5244375756366635, -66, -25, 1.855, 1.164),
		p(3, 1, 0.685546875, -0.3753706470552125, 0, 0, 1, 1),
		p(4, 1, 1, -0.6699125300354287, 0, 0, 1, 1),
		p(0, 2, -1, 0.035910396862284255, 0, 0, 1, 1),
		p(1, 2, -0.4921875, 0.005378616309457018, 90, 23, 1, 1.981),
		p(2, 2, 0.021484375, -0.1365043639066228, 0, 42, 1, 1),
		p(3, 2, 0.4765625, 0.05925822904974043, -30, 0, 1.95, 0.44),
		p(4, 2, 1, 0.251428847823418, 0, 0, 1, 1),
		p(0, 3, -1, 0.6968336464764276, -68, 0, 1, 0.786),
		p(1, 3, -0.6904296875, 0.5890744209958608, -68, 0, 1, 1),
		p(2, 3, 0.1845703125, 0.3879238667654693, 61, 0, 1, 1),
		p(3, 3, 0.60546875, 0.4633553246018661, -47, -59, 0.849, 1.73),
		p(4, 3, 1, 0.6214021886400309, -33, 0, 0.377, 1.604),
		p(0, 4, -1, 1, 0, 0, 1, 1),
		p(1, 4, -0.5, 1, 0, -73, 1, 1),
		p(2, 4, -0.3271484375, 1, 0, -24, 0.314, 2.704),
		p(3, 4, 0.5, 1, 0, 0, 1, 1),
		p(4, 4, 1, 1, 0, 0, 1, 1),
	]),
] as const;

export const randomRange = (min: number, max: number): number =>
	Math.random() * (max - min) + min;

function clamp(x: number, min: number, max: number): number {
	return Math.min(Math.max(x, min), max);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
	const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
	return t * t * (3 - 2 * t);
}

function smoothifyControlPoints(
	conf: ControlPointConf[],
	w: number,
	h: number,
	iterations = 2,
	factor = 0.5,
	factorIterationModifier = 0.1,
): void {
	let grid: ControlPointConf[][] = [];
	let f = factor;

	for (let j = 0; j < h; j++) {
		grid[j] = [];
		for (let i = 0; i < w; i++) {
			grid[j][i] = conf[j * w + i];
		}
	}

	const kernel = [
		[1, 2, 1],
		[2, 4, 2],
		[1, 2, 1],
	];
	const kernelSum = 16;

	for (let iter = 0; iter < iterations; iter++) {
		const newGrid: ControlPointConf[][] = [];
		for (let j = 0; j < h; j++) {
			newGrid[j] = [];
			for (let i = 0; i < w; i++) {
				if (i === 0 || i === w - 1 || j === 0 || j === h - 1) {
					newGrid[j][i] = grid[j][i];
					continue;
				}
				let sumX = 0;
				let sumY = 0;
				let sumUR = 0;
				let sumVR = 0;
				let sumUP = 0;
				let sumVP = 0;
				for (let dj = -1; dj <= 1; dj++) {
					for (let di = -1; di <= 1; di++) {
						const weight = kernel[dj + 1][di + 1];
						const nb = grid[j + dj][i + di];
						sumX += nb.x * weight;
						sumY += nb.y * weight;
						sumUR += nb.ur * weight;
						sumVR += nb.vr * weight;
						sumUP += nb.up * weight;
						sumVP += nb.vp * weight;
					}
				}
				const avgX = sumX / kernelSum;
				const avgY = sumY / kernelSum;
				const avgUR = sumUR / kernelSum;
				const avgVR = sumVR / kernelSum;
				const avgUP = sumUP / kernelSum;
				const avgVP = sumVP / kernelSum;

				const cur = grid[j][i];
				const newX = cur.x * (1 - f) + avgX * f;
				const newY = cur.y * (1 - f) + avgY * f;
				const newUR = cur.ur * (1 - f) + avgUR * f;
				const newVR = cur.vr * (1 - f) + avgVR * f;
				const newUP = cur.up * (1 - f) + avgUP * f;
				const newVP = cur.vp * (1 - f) + avgVP * f;
				newGrid[j][i] = p(i, j, newX, newY, newUR, newVR, newUP, newVP);
			}
		}
		grid = newGrid;
		f = Math.min(1, Math.max(f + factorIterationModifier, 0));
	}

	for (let j = 0; j < h; j++) {
		for (let i = 0; i < w; i++) {
			conf[j * w + i] = grid[j][i];
		}
	}
}

function noise(x: number, y: number): number {
	return fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
}

function fract(x: number): number {
	return x - Math.floor(x);
}

function smoothNoise(x: number, y: number): number {
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const x1 = x0 + 1;
	const y1 = y0 + 1;

	const xf = x - x0;
	const yf = y - y0;

	const u = xf * xf * (3 - 2 * xf);
	const v = yf * yf * (3 - 2 * yf);

	const n00 = noise(x0, y0);
	const n10 = noise(x1, y0);
	const n01 = noise(x0, y1);
	const n11 = noise(x1, y1);

	const nx0 = n00 * (1 - u) + n10 * u;
	const nx1 = n01 * (1 - u) + n11 * u;

	return nx0 * (1 - v) + nx1 * v;
}

function computeNoiseGradient(
	perlinFn: (x: number, y: number) => number,
	x: number,
	y: number,
	epsilon = 0.001,
): [number, number] {
	const n1 = perlinFn(x + epsilon, y);
	const n2 = perlinFn(x - epsilon, y);
	const n3 = perlinFn(x, y + epsilon);
	const n4 = perlinFn(x, y - epsilon);
	const dx = (n1 - n2) / (2 * epsilon);
	const dy = (n3 - n4) / (2 * epsilon);
	const len = Math.sqrt(dx * dx + dy * dy) || 1;
	return [dx / len, dy / len];
}

export function generateControlPoints(
	width: number,
	height: number,
	variationFraction = 0.2,
	normalOffset = 0.3,
	blendFactor = 0.8,
	smoothIters = 3,
	smoothFactor = 0.3,
	smoothModifier = -0.05,
): ControlPointPreset {
	const w = width ?? Math.floor(randomRange(3, 6));
	const h = height ?? Math.floor(randomRange(3, 6));

	const conf: ControlPointConf[] = [];
	const dx = w === 1 ? 0 : 2 / (w - 1);
	const dy = h === 1 ? 0 : 2 / (h - 1);

	for (let j = 0; j < h; j++) {
		for (let i = 0; i < w; i++) {
			const baseX = (w === 1 ? 0 : i / (w - 1)) * 2 - 1;
			const baseY = (h === 1 ? 0 : j / (h - 1)) * 2 - 1;

			const isBorder = i === 0 || i === w - 1 || j === 0 || j === h - 1;
			const pertX = isBorder
				? 0
				: randomRange(-variationFraction * dx, variationFraction * dx);
			const pertY = isBorder
				? 0
				: randomRange(-variationFraction * dy, variationFraction * dy);
			let x = baseX + pertX;
			let y = baseY + pertY;

			const ur = isBorder ? 0 : randomRange(-60, 60);
			const vr = isBorder ? 0 : randomRange(-60, 60);
			const up = isBorder ? 1 : randomRange(0.8, 1.2);
			const vp = isBorder ? 1 : randomRange(0.8, 1.2);

			if (!isBorder) {
				const uNorm = (baseX + 1) / 2;
				const vNorm = (baseY + 1) / 2;

				const [nx, ny] = computeNoiseGradient(smoothNoise, uNorm, vNorm, 0.001);
				let offsetX = nx * normalOffset;
				let offsetY = ny * normalOffset;

				const distToBorder = Math.min(uNorm, 1 - uNorm, vNorm, 1 - vNorm); // in [0,0.5]

				const weight = smoothstep(0, 1.0, distToBorder);
				offsetX *= weight;
				offsetY *= weight;

				x = x * (1 - blendFactor) + (x + offsetX) * blendFactor;
				y = y * (1 - blendFactor) + (y + offsetY) * blendFactor;
			}
			conf.push(p(i, j, x, y, ur, vr, up, vp));
		}
	}

	smoothifyControlPoints(conf, w, h, smoothIters, smoothFactor, smoothModifier);

	return preset(w, h, conf);
}
