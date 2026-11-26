import type Flipbook from "./flipbook";
import type { ScreenPoint } from "./flipbook";

type Chapter = {
	title: string;
	pages: string;
	firstPage: number;
};

const CHAPTERS: Chapter[] = [
	{ title: "About Me", pages: "1-3", firstPage: 1 },
	{ title: "LIFE", pages: "4-11", firstPage: 4 },
	{ title: "Rewind", pages: "11-18", firstPage: 11 },
	{ title: "Has Been", pages: "19-26", firstPage: 19 },
	{ title: "portfolio", pages: "27-34", firstPage: 27 },
	{ title: "SECOND Coming", pages: "35-43", firstPage: 35 },
];

const normalize = (value: string) =>
	value.trim().replace(/\s+/g, " ").toLowerCase();

const pageIndexToProgress = (index: number) =>
	index % 2 === 0 ? index / 2 : (index + 1) / 2;

const sleep = (ms: number) =>
	new Promise<void>(resolve => window.setTimeout(resolve, ms));

// Convert a screen quad into a CSS matrix3d that maps the overlay rectangle
// onto the projected (and possibly perspective-skewed) book page.
function quadMatrix(
	tl: ScreenPoint,
	tr: ScreenPoint,
	br: ScreenPoint,
	bl: ScreenPoint,
	width: number,
	height: number,
): number[] {
	const dx1 = tr.x - br.x;
	const dx2 = bl.x - br.x;
	const dx3 = tl.x - tr.x + br.x - bl.x;
	const dy1 = tr.y - br.y;
	const dy2 = bl.y - br.y;
	const dy3 = tl.y - tr.y + br.y - bl.y;

	let a = tr.x - tl.x;
	let b = bl.x - tl.x;
	let d = tr.y - tl.y;
	let e = bl.y - tl.y;
	let g = 0;
	let h = 0;

	const denominator = dx1 * dy2 - dx2 * dy1;
	if ((dx3 !== 0 || dy3 !== 0) && Math.abs(denominator) > 1e-9) {
		g = (dx3 * dy2 - dx2 * dy3) / denominator;
		h = (dx1 * dy3 - dx3 * dy1) / denominator;
		a = tr.x - tl.x + g * tr.x;
		b = bl.x - tl.x + h * bl.x;
		d = tr.y - tl.y + g * tr.y;
		e = bl.y - tl.y + h * bl.y;
	}

	const h11 = a / width;
	const h12 = b / height;
	const h21 = d / width;
	const h22 = e / height;
	const h31 = g / width;
	const h32 = h / height;

	return [
		h11, h21, 0, h31,
		h12, h22, 0, h32,
		0, 0, 1, 0,
		tl.x, tl.y, 0, 1,
	];
}

export function initChapterConsole(flipbook: Flipbook): void {
	const root = document.getElementById("chapter-code");
	const surface = document.getElementById("chapter-code-surface");
	const output = document.getElementById("chapter-output");
	const content = document.querySelector(
		".chapter-code-content",
	) as HTMLElement | null;
	const input = document.getElementById(
		"chapter-name",
	) as HTMLInputElement | null;
	if (!root || !surface || !output || !content || !input) return;

	const width = surface.offsetWidth || 764;
	const height = surface.offsetHeight || 1080;
	let active = false;
	let running = false;
	let lastValues: number[] = [];

	const syncInputWidth = () => {
		const length = input.value.length || input.placeholder.length;
		input.style.width = `${length + 1}ch`;
	};

	const clearInput = () => {
		output.replaceChildren();
		input.value = "";
		syncInputWidth();
	};

	const positionOverlay = () => {
		if (!active) return;
		const quad = flipbook.getFaceScreenQuad(4);
		if (!quad || quad.length !== 4) return;
		const values = quadMatrix(quad[0], quad[1], quad[2], quad[3], width, height);
		if (values.some(value => !Number.isFinite(value))) return;

		// The page is bent, so its real center is not the center of the corner
		// quad. Nudge the mapping until the code sits on that visible center.
		const pageCenter = flipbook.getFaceScreenPoint(4, 0.5, 0.5);
		if (pageCenter) {
			const halfW = width / 2;
			const halfH = height / 2;
			const denom =
				values[3] * halfW + values[7] * halfH + 1;
			if (Math.abs(denom) > 1e-9) {
				const mappedX =
					(values[0] * halfW + values[4] * halfH + values[12]) / denom;
				const mappedY =
					(values[1] * halfW + values[5] * halfH + values[13]) / denom;
				values[12] += pageCenter.x - mappedX;
				values[13] += pageCenter.y - mappedY;
			}
		}

		if (
			values.length === lastValues.length &&
			values.every((value, index) => value === lastValues[index])
		) {
			return;
		}
		surface.style.transform = `matrix3d(${values.join(",")})`;
		lastValues = values;
	};

	const animate = () => {
		positionOverlay();
		window.requestAnimationFrame(animate);
	};

	const clear = () => {
		clearInput();
		input.disabled = false;
		running = false;
	};

	const setActive = (progress: number) => {
		const shouldBeActive = Math.abs(progress - 2) < 0.06;
		if (shouldBeActive === active) return;

		active = shouldBeActive;
		root.classList.toggle("active", active);
		root.setAttribute("aria-hidden", String(!active));
		if (active) positionOverlay();
		else {
			lastValues = [];
			clear();
		}
	};

	const addLine = (text: string, className?: string) => {
		const line = document.createElement("div");
		line.className = className ? `line ${className}` : "line";
		line.textContent = text;
		output.appendChild(line);
	};

	const run = async () => {
		if (running || !active) return;

		const query = normalize(input.value);
		output.replaceChildren();
		if (!query) return;

		const chapter = CHAPTERS.find(
			item => normalize(item.title) === query,
		);
		if (!chapter) {
			addLine("Chapter not found", "error");
			return;
		}

		running = true;
		input.disabled = true;
		const steps = [
			"Compiling chapter...",
			"Resolving pages...",
			"Linking assets...",
		];
		const bar = document.createElement("div");
		bar.className = "line progress";
		output.appendChild(bar);

		for (let step = 0; step < steps.length; step++) {
			addLine(steps[step]);
			const ratio = (step + 1) / steps.length;
			const filled = Math.round(ratio * 20);
			bar.textContent = `[${"█".repeat(filled)}${"·".repeat(20 - filled)}] ${Math.round(ratio * 100)}%`;
			await sleep(360);
		}

		addLine(`${chapter.title} -> pages ${chapter.pages}`, "result");
		await sleep(420);

		// If the chapter starts on the page being viewed, flip to the next
		// spread so the jump is visible.
		let targetPage = chapter.firstPage;
		if (
			Math.abs(pageIndexToProgress(targetPage) - flipbook.getProgress()) <
			0.06
		) {
			targetPage = (Math.round(flipbook.getProgress()) + 1) * 2;
		}
		flipbook.goToPage(targetPage);
		clear();
	};

	syncInputWidth();
	flipbook.onProgressChange(setActive);
	setActive(flipbook.getProgress());
	window.requestAnimationFrame(animate);

	input.addEventListener("input", syncInputWidth);
	input.addEventListener("keydown", event => {
		event.stopPropagation();
		if (event.key === "Enter") {
			event.preventDefault();
			void run();
		} else if (event.key === "Escape") {
			event.preventDefault();
			clearInput();
		}
	});

	// Clicking anywhere on the printed code focuses the embedded input.
	content.addEventListener("click", event => {
		event.stopPropagation();
		if (event.target !== input) input.focus();
	});

	// Typing also works when the book has focus but the input wasn't clicked.
	document.addEventListener(
		"keydown",
		event => {
			if (!active || running || event.target === input) return;
			const target = event.target as HTMLElement | null;
			if (target?.closest(".chapter-code")) return;

			if (event.key === "Enter") {
				event.preventDefault();
				event.stopPropagation();
				void run();
			} else if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				clearInput();
			} else if (event.key === "Backspace") {
				event.preventDefault();
				event.stopPropagation();
				input.value = input.value.slice(0, -1);
				syncInputWidth();
			} else if (
				event.key.length === 1 &&
				!event.ctrlKey &&
				!event.metaKey &&
				!event.altKey
			) {
				event.preventDefault();
				event.stopPropagation();
				input.value += event.key;
				syncInputWidth();
			}
		},
		true,
	);

	// Keep the overlay from starting a swipe, click, zoom or page turn.
	for (const type of [
		"pointerdown",
		"mousedown",
		"touchstart",
		"click",
		"dblclick",
		"contextmenu",
		"wheel",
	]) {
		content.addEventListener(type, event => {
			event.stopPropagation();
			if (
				type === "wheel" ||
				type === "dblclick" ||
				type === "contextmenu"
			) {
				event.preventDefault();
			}
		});
	}
}
