window.__ModuleLoader__.load({
	id: "@local/dsh-token-balance",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");
		const { jsx, jsxs } = require("react/jsx-runtime");

		//#region styles
		const CSS = [
			".tb-root{position:relative;display:inline-flex;align-items:center}",
			".tb-chip{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 4px;border:0;border-radius:6px;background:0 0;font:inherit;font-size:12px;line-height:18px;cursor:pointer;white-space:nowrap;font-variant-numeric:tabular-nums}",
			".tb-chip:hover,.tb-chip:focus-visible{background:var(--dsw-alias-fill-l1);outline:0}",
			".tb-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary);opacity:.45;margin-right:1px}",
			".tb-dot-ok{background:var(--dsw-alias-state-success-primary,#3fa45b);opacity:1}",
			".tb-dot-bad{background:var(--dsw-alias-state-error-primary,#d84a3a);opacity:1}",
			".tb-bal{color:var(--dsw-alias-state-success-primary,#3fa45b)}",
			".tb-spent{color:var(--dsw-alias-label-tertiary)}",
			".tb-sep{color:var(--dsw-alias-label-tertiary);opacity:.55}",
			".tb-panel{position:fixed;z-index:210;box-sizing:border-box;width:280px;padding:10px 12px;border-radius:10px;border:.5px solid var(--dsw-alias-border-l1);background-color:var(--dsw-alias-bg-base,#1b1b1d);background-image:linear-gradient(var(--dsw-specific-menu,rgba(27,27,29,.94)),var(--dsw-specific-menu,rgba(27,27,29,.94)));-webkit-backdrop-filter:blur(20px) saturate(1.15);backdrop-filter:blur(20px) saturate(1.15);box-shadow:var(--dsw-elevation-prominent,0 8px 24px rgba(0,0,0,.35));color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px}",
			".tb-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 6px;color:var(--dsw-alias-label-tertiary);font-size:11px;letter-spacing:.02em;text-transform:uppercase}",
			".tb-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:2px 0}",
			".tb-row dt{color:var(--dsw-alias-label-tertiary);margin:0}",
			".tb-row dd{margin:0;font-variant-numeric:tabular-nums}",
			".tb-dl{margin:0}",
			".tb-hr{height:1px;margin:7px 0;background:var(--dsw-alias-border-l1);opacity:.7}",
			".tb-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:7px;color:var(--dsw-alias-label-tertiary);font-size:11px}",
			".tb-btn{border:0;border-radius:5px;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;padding:2px 6px;cursor:pointer}",
			".tb-btn:hover,.tb-btn:focus-visible{background:var(--dsw-alias-fill-l1);color:var(--dsw-alias-label-primary);outline:0}",
			".tb-err{color:var(--dsw-alias-state-error-primary,#d84a3a)}",
			".tb-muted{color:var(--dsw-alias-label-tertiary)}",
			".tb-note{margin-top:6px;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:14px}"
		].join("");
		const TAG = "@local/dsh-token-balance/chip.css";
		if (typeof document !== "undefined" && document.querySelector('style[data-plugin-css="' + TAG + '"]') === null) {
			const style = document.createElement("style");
			style.dataset.plugin = "@local/dsh-token-balance";
			style.dataset.pluginCss = TAG;
			style.textContent = CSS;
			document.head.appendChild(style);
		}
		//#endregion

		//#region helpers
		const SYMBOL = { CNY: "\u00a5", USD: "$" };
		/**
		 * Official DeepSeek list prices, USD per 1M tokens, as [off-peak, peak]
		 * for cache hit / cache miss / output.
		 * Source: https://api-docs.deepseek.com/quick_start/pricing/ (checked 2026-10-23).
		 * Peak runs 01:00-04:00 and 06:00-10:00 UTC, Monday-Friday, excluding
		 * Chinese public holidays; every other hour is off-peak at half the rate.
		 */
		const PRICES = {
			"deepseek-flash": { hit: [0.003, 0.006], miss: [0.15, 0.3], out: [0.6, 1.2] },
			"deepseek-v4-pro": { hit: [0.022, 0.044], miss: [0.66, 1.32], out: [1.98, 3.96] }
		};
		const FALLBACK_MODEL = "deepseek-flash";
		/** CNY per USD, used only to restate the USD price list in the popover. */
		const CNY_PER_USD = 7.2;
		const currencySymbol = (code) => SYMBOL[code] ?? (code ? code + " " : "");
		const money = (amount) => {
			const value = Number(amount);
			if (!Number.isFinite(value)) return String(amount);
			if (value > 0 && value < 0.01) return "<0.01";
			return value.toFixed(2);
		};
		const cash = (code, amount) => {
			const text = money(amount);
			return text.startsWith("<") ? "<" + currencySymbol(code) + text.slice(1) : currencySymbol(code) + text;
		};
		/** Spend is small on cheap models, so sub-cent values keep three/four digits. */
		const moneyPrecise = (amount) => {
			const value = Number(amount);
			if (!Number.isFinite(value)) return String(amount);
			if (value >= 0.1) return value.toFixed(2);
			if (value >= 0.01) return value.toFixed(3);
			return value.toFixed(4);
		};
		const cashPrecise = (code, amount) => currencySymbol(code) + moneyPrecise(amount);
		const exact = (value) => Number(value || 0).toLocaleString("ru-RU");
		const num = (value) => String(value).replace(".", ",");
		const clock = (at) => {
			if (!at) return "\u2014";
			try { return new Date(at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch { return "\u2014"; }
		};
		const billedInput = (usage) => Number(usage.uncachedInputTokens || 0) + Number(usage.cacheReadTokens || 0) + Number(usage.cacheWriteTokens || 0);
		const cachePercent = (usage) => {
			const input = billedInput(usage);
			if (input <= 0) return null;
			return Math.round((Number(usage.cacheReadTokens || 0) / input) * 100);
		};
		/** Whether the given instant falls in DeepSeek's peak-price window (UTC). */
		const isPeak = (now) => {
			const day = now.getUTCDay();
			if (day === 0 || day === 6) return false;
			const hour = now.getUTCHours();
			return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10);
		};
		/** Price row for a model id, falling back to the Flash list. */
		const priceOf = (model) => PRICES[model] ?? PRICES[FALLBACK_MODEL];
		/** Estimated spend in USD for one usage row at the given tier (0 = off-peak, 1 = peak). */
		const spentUsd = (usage, price, tier) => {
			if (!usage) return 0;
			return (Number(usage.cacheReadTokens || 0) * price.hit[tier]
				+ Number(usage.uncachedInputTokens || 0) * price.miss[tier]
				+ Number(usage.cacheWriteTokens || 0) * price.miss[tier]
				+ Number(usage.outputTokens || 0) * price.out[tier]) / 1e6;
		};
		//#endregion

		//#region component
		function BalanceChip({ useProjection }) {
			const usage = typeof useProjection === "function" ? useProjection("tokenUsage") : undefined;
			const [snapshot, setSnapshot] = react.useState({ status: "idle", payload: null, error: null });
			const [open, setOpen] = react.useState(false);
			const [position, setPosition] = react.useState(null);
			const anchorRef = react.useRef(null);
			const panelRef = react.useRef(null);

			const refresh = react.useCallback(async () => {
				setSnapshot((previous) => ({ status: previous.payload ? "refresh" : "load", payload: previous.payload, error: null }));
				try {
					const response = await fetch("/token-balance", { cache: "no-store" });
					if (!response.ok) throw new Error("HTTP " + response.status);
					const payload = await response.json();
					if (payload && payload.ok === true) setSnapshot({ status: "ready", payload, error: null });
					else setSnapshot({ status: "error", payload: null, error: (payload && payload.error) || "unavailable" });
				} catch (error) {
					setSnapshot((previous) => ({ status: "error", payload: previous.payload, error: String((error && error.message) || error) }));
				}
			}, []);

			react.useEffect(() => {
				refresh();
				const timer = setInterval(refresh, 60000);
				return () => clearInterval(timer);
			}, [refresh]);

			const place = react.useCallback(() => {
				const anchor = anchorRef.current;
				if (!anchor) return;
				const rect = anchor.getBoundingClientRect();
				setPosition({ bottom: Math.max(8, Math.round(window.innerHeight - rect.top + 6)), left: Math.max(8, Math.round(rect.left)) });
			}, []);

			react.useEffect(() => {
				if (!open) return undefined;
				place();
				const onPointerDown = (event) => {
					const anchor = anchorRef.current;
					const panel = panelRef.current;
					if (anchor && anchor.contains(event.target)) return;
					if (panel && panel.contains(event.target)) return;
					setOpen(false);
				};
				const onKeyDown = (event) => { if (event.key === "Escape") setOpen(false); };
				const onMove = () => setOpen(false);
				document.addEventListener("pointerdown", onPointerDown, true);
				document.addEventListener("keydown", onKeyDown);
				window.addEventListener("resize", onMove);
				window.addEventListener("scroll", onMove, true);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown, true);
					document.removeEventListener("keydown", onKeyDown);
					window.removeEventListener("resize", onMove);
					window.removeEventListener("scroll", onMove, true);
				};
			}, [open, place]);

			const balances = (snapshot.payload && Array.isArray(snapshot.payload.balances)) ? snapshot.payload.balances : [];
			const cny = balances.find((row) => row.currency === "CNY") ?? null;
			const usd = balances.find((row) => row.currency === "USD") ?? null;
			const primary = cny ?? usd;
			const selection = typeof useProjection === "function" ? useProjection("modelSelection") : undefined;
			const modelId = (selection && (selection.lastUsed?.model ?? selection.pending?.model)) || FALLBACK_MODEL;
			const tier = isPeak(new Date()) ? 1 : 0;
			const price = priceOf(modelId);
			const totalTokens = usage ? billedInput(usage) + Number(usage.outputTokens || 0) : 0;
			const hit = usage ? cachePercent(usage) : null;
			const costUsd = usage ? spentUsd(usage, price, tier) : 0;
			const costCny = costUsd * CNY_PER_USD;
			const tierLabel = tier === 1 ? "пик" : "вне пик";
			const dotClass = "tb-dot" + (snapshot.status === "error" ? " tb-dot-bad" : primary ? " tb-dot-ok" : "");

			const balanceText = primary
				? (cny ? cash("CNY", cny.total) : "") + (cny && usd ? " \u00b7 " : "") + (usd ? cash("USD", usd.total) : "")
				: (snapshot.status === "error" ? "\u2014" : "\u00b7\u00b7\u00b7");
			const spentText = usage ? "потрачено " + cashPrecise("USD", costUsd) : null;

			const onChipClick = () => { setOpen((value) => !value); if (!open) refresh(); };

			const panel = open && position
				? jsxs("div", {
					ref: panelRef,
					className: "tb-panel",
					style: { bottom: position.bottom, left: position.left },
					role: "dialog",
					"aria-label": "Баланс и расход",
					children: [
						jsx("div", { className: "tb-title", children: [
							jsx("span", { children: "Баланс DeepSeek" }, "t"),
							snapshot.payload && snapshot.payload.available === false
								? jsx("span", { className: "tb-err", children: "недоступен" }, "a")
								: null
						] }, "title"),
						primary ? jsxs("div", { className: "tb-row", children: [
							jsx("dt", { children: primary.currency }, "c"),
							jsx("dd", { className: "tb-bal", children: cash(primary.currency, primary.total) }, "v")
						] }, "primary") : jsx("div", { className: "tb-row tb-muted", children: "нет данных по балансу" }, "nobalance"),
						primary && (Number(primary.granted || 0) > 0 || Number(primary.toppedUp || 0) > 0)
							? jsxs("div", { className: "tb-row tb-muted", children: [
								jsx("dt", { children: "пополнено / бонус" }, "l"),
								jsx("dd", { children: money(primary.toppedUp) + " / " + money(primary.granted) }, "v")
							] }, "split")
							: null,
						jsx("div", { className: "tb-hr" }, "hr"),
						jsx("div", { className: "tb-title", children: [
							jsx("span", { children: "Эта сессия" }, "t"),
							jsx("span", { className: "tb-muted", children: modelId + " \u00b7 " + tierLabel }, "m")
						] }, "t2"),
						usage
							? jsxs("dl", { className: "tb-dl", children: [
								jsxs("div", { className: "tb-row", children: [jsx("dt", { children: "потрачено" }, "a"), jsx("dd", { children: cashPrecise("USD", costUsd) + "  (\u2248 " + cashPrecise("CNY", costCny) + ")" }, "b")] }, "r0"),
								jsxs("div", { className: "tb-row", children: [jsx("dt", { children: "вход без кеша" }, "a"), jsx("dd", { children: exact(usage.uncachedInputTokens) }, "b")] }, "r1"),
								jsxs("div", { className: "tb-row", children: [jsx("dt", { children: "вход из кеша" }, "a"), jsx("dd", { children: exact(usage.cacheReadTokens) + (hit === null ? "" : "  (" + hit + "%)") }, "b")] }, "r2"),
								Number(usage.cacheWriteTokens || 0) !== 0
									? jsxs("div", { className: "tb-row", children: [jsx("dt", { children: "запись в кеш" }, "a"), jsx("dd", { children: exact(usage.cacheWriteTokens) }, "b")] }, "r3")
									: null,
								jsxs("div", { className: "tb-row", children: [jsx("dt", { children: "выход" }, "a"), jsx("dd", { children: exact(usage.outputTokens) }, "b")] }, "r4"),
								jsxs("div", { className: "tb-row", children: [jsx("dt", { children: "всего токенов" }, "a"), jsx("dd", { children: exact(totalTokens) }, "b")] }, "r5")
							] }, "usage")
							: jsx("div", { className: "tb-muted", children: "нет данных по токенам" }, "nousage"),
						jsx("div", { className: "tb-note", children: "Оценка по прайсу DeepSeek, USD за 1M токенов (вне пик / пик): кеш " + num(price.hit[0]) + " / " + num(price.hit[1]) + ", вход " + num(price.miss[0]) + " / " + num(price.miss[1]) + ", выход " + num(price.out[0]) + " / " + num(price.out[1]) + ". ¥ — пересчёт по курсу " + num(CNY_PER_USD) + "." }, "note"),
						jsxs("div", { className: "tb-foot", children: [
							jsx("span", { children: snapshot.status === "error" && snapshot.error ? jsx("span", { className: "tb-err", children: "ошибка: " + snapshot.error }, "e") : "обновлено в " + clock(snapshot.payload && snapshot.payload.at) }, "f"),
							jsx("button", { type: "button", className: "tb-btn", onClick: refresh, children: snapshot.status === "refresh" || snapshot.status === "load" ? "..." : "обновить" }, "b")
						] }, "foot")
					]
				})
				: null;

			return jsxs("span", {
				ref: anchorRef,
				className: "tb-root",
				children: [
					jsxs("button", {
						type: "button",
						className: "tb-chip",
						onClick: onChipClick,
						"aria-expanded": open ? "true" : "false",
						"aria-haspopup": "dialog",
						title: "Баланс DeepSeek и оценка расхода по токенам этой сессии",
						children: [
							jsx("span", { className: dotClass }, "dot"),
							jsx("span", { className: "tb-bal", children: balanceText }, "b"),
							spentText ? jsx("span", { className: "tb-sep", children: "\u00b7" }, "s") : null,
							spentText ? jsx("span", { className: "tb-spent", children: spentText }, "sp") : null
						]
					}, "chip"),
					panel
				]
			}, "root");
		}
		//#endregion

		/** Required services: the slot registry. */
		const inject = ["slots"];

		/**
		 * Client body: register the balance/usage control in the composer dock,
		 * next to the built-in activity and token statistics.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
				name: "conversation.composer.dock",
				id: "token-balance",
				order: 2
			}, BalanceChip));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
