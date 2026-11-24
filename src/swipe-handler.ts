import EventEmitter from "./event-emitter";

export default class SwipeHandler extends EventEmitter {
	private curSwipe?: Swipe;

	constructor(private targetElement: HTMLElement) {
		super();

		this.addTouchListeners();
		this.addMouseListeners();

		// A drag can end outside the canvas. Without these, the handler keeps
		// reporting a pressed pointer and scroll turning is ignored.
		window.addEventListener("mouseup", () => this.endMouseSwipe());
		window.addEventListener("blur", () => this.clearSwipe());
		document.addEventListener("touchend", () => this.endTouchSwipe());
		document.addEventListener("touchcancel", () => this.clearSwipe());
	}

	private endMouseSwipe() {
		if (this.curSwipe && !this.curSwipe.touchId) {
			this.curSwipe = undefined;
			this.triggerEvent("swipeEnd", [this.curSwipe]);
		}
	}

	private endTouchSwipe() {
		if (this.curSwipe?.touchId !== undefined && this.curSwipe.touchId !== null) {
			this.curSwipe = undefined;
			this.triggerEvent("swipeEnd", [this.curSwipe]);
		}
	}

	private clearSwipe() {
		const hadSwipe = !!this.curSwipe;
		this.curSwipe = undefined;
		if (hadSwipe) this.triggerEvent("swipeEnd", [undefined]);
	}

	private addTouchListeners() {
		this.targetElement.addEventListener("touchstart", event => {
			if (!this.curSwipe) {
				this.curSwipe = {
					startX: event.touches[0].clientX,
					startY: event.touches[0].clientY,
					prevX: event.touches[0].clientX,
					prevY: event.touches[0].clientY,
					x: event.touches[0].clientX,
					y: event.touches[0].clientY,
					touchId: event.touches[0].identifier,
					direction: null,
				};
				this.triggerEvent("swipeStart", [this.curSwipe]);
			}
		});

		this.targetElement.addEventListener("touchmove", event => {
			const drag = Array.from(event.touches).find(
				touch => touch.identifier === this.curSwipe?.touchId,
			);
			if (!drag || !this.curSwipe) return;

			this.curSwipe.prevX = this.curSwipe.x;
			this.curSwipe.prevY = this.curSwipe.y;

			this.curSwipe.x = drag.clientX;
			this.curSwipe.y = drag.clientY;

			this.triggerEvent("swipeMove", [this.curSwipe]);
		});

		this.targetElement.addEventListener("touchend", event => {
			if (
				event.changedTouches.length === 1 &&
				event.touches.length === 0
			) {
				this.curSwipe = undefined;
				this.triggerEvent("swipeEnd", [this.curSwipe]);
			}
		});
	}

	private addMouseListeners() {
		this.targetElement.addEventListener("mousedown", event => {
			if (!this.curSwipe) {
				this.curSwipe = {
					startX: event.clientX,
					startY: event.clientY,
					prevX: event.clientX,
					prevY: event.clientY,
					x: event.clientX,
					y: event.clientY,
					touchId: null,
					direction: null,
				};
				this.triggerEvent("swipeStart", [this.curSwipe]);
			}
		});

		this.targetElement.addEventListener("mousemove", event => {
			if (this.curSwipe && !this.curSwipe.touchId) {
				this.curSwipe.prevX = this.curSwipe.x;
				this.curSwipe.prevY = this.curSwipe.y;

				this.curSwipe.x = event.clientX;
				this.curSwipe.y = event.clientY;

				this.triggerEvent("swipeMove", [this.curSwipe]);
			}
		});

		this.targetElement.addEventListener("mouseup", () => {
			this.endMouseSwipe();
		});
	}

	public isPointerDown() {
		return !!this.curSwipe;
	}
}
