document.addEventListener("DOMContentLoaded", () => {
    const inputs = ["bookPrice", "royalty", "cpc", "clicksToSale"];
    let currentScore = 0;

    inputs.forEach(id => {
        document.getElementById(id).addEventListener("input", calculate);
    });

    // Setup Share Buttons
    document.getElementById("btn-twitter").addEventListener("click", shareTwitter);
    document.getElementById("btn-linkedin").addEventListener("click", shareLinkedIn);

    calculate(); // Initial run

    function calculate() {
        const price = parseFloat(document.getElementById("bookPrice").value) || 0;
        const royaltyPercent = parseFloat(document.getElementById("royalty").value) || 0;
        const cpc = parseFloat(document.getElementById("cpc").value) || 0;
        const clicks = parseFloat(document.getElementById("clicksToSale").value) || 0;

        // 1. Calculate Royalty
        const estRoyalty = price * (royaltyPercent / 100);

        // 2. Cost Per Acquisition
        const cpa = cpc * clicks;

        // 3. Net Profit
        const profit = estRoyalty - cpa;

        // Update UI
        document.getElementById("royaltyVal").textContent = "$" + estRoyalty.toFixed(2);
        document.getElementById("cpaVal").textContent = "$" + cpa.toFixed(2);
        
        const profitEl = document.getElementById("profitVal");
        profitEl.textContent = (profit < 0 ? "-" : "") + "$" + Math.abs(profit).toFixed(2);
        profitEl.className = "result-value " + (profit >= 0 ? "positive" : "negative");

        // Squeeze Meter Logic
        const meter = document.getElementById("squeezeMeter");
        const text = document.getElementById("squeezeText");
        
        let score = 0;
        if (profit < 0) score = 100;
        else if (profit === 0) score = 90;
        else {
            const percentage = Math.min(profit / 5, 1); 
            score = 100 - (percentage * 100);
        }
        currentScore = Math.round(score);

        meter.style.width = score + "%";
        
        if (score > 90) {
            meter.style.background = "#ef4444";
            text.textContent = "CRITICAL: You are losing money on every sale.";
        } else if (score > 60) {
            meter.style.background = "#fbbf24";
            text.textContent = "WARNING: Margins are razor thin.";
        } else {
            meter.style.background = "#4ade80";
            text.textContent = "HEALTHY: Your ads are profitable.";
        }

        // Show/hide optimization kit based on profit
        const optimizationKit = document.getElementById("optimization-kit");
        if (profit < 0) {
            optimizationKit.style.display = "block";
        } else {
            optimizationKit.style.display = "none";
        }

        // Show share buttons if interaction has happened (simple check: always show)
        document.getElementById("share-buttons").style.display = "block";
    }

    function shareTwitter() {
        const text = `My Amazon Book "Ad Squeeze" Score is ${currentScore}/100. 📉

Are your ads actually profitable? Check the calculator:`;
        const url = "https://sonexial.com/calculator.html";
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
    }

    function shareLinkedIn() {
        // LinkedIn is stricter, mostly just shares URL, but we can try adding title/summary param hacks or just open the share dialog
        const url = "https://sonexial.com/calculator.html";
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, "_blank");
    }
});
