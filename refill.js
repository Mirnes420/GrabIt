const USER_ID = localStorage.getItem("grabit_tracked_user") || "guest_user";

const BACKEND_NGROK_DOMAIN = "cringing-niece-playpen.ngrok-free.dev";
const httpApiBase = `https://${BACKEND_NGROK_DOMAIN}`;

async function fetchBalance() {
    try {
        const res = await fetch(`${httpApiBase}/api/balance/${USER_ID}`, {
            headers: {
                "ngrok-skip-browser-warning": "true"
            }
        });
        const data = await res.json();
        document.getElementById("current-balance").innerText = data.balance.toLocaleString();
    } catch (e) {
        console.error("Failed to fetch balance", e);
    }
}

document.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const amountCents = parseInt(e.target.getAttribute('data-amount-cents')); // e.g., 500 for €5.00
        const amountTokens = parseInt(e.target.getAttribute('data-amount')); // e.g., 100000 tokens
        console.log("sending tokens", amountTokens, "for amount", amountCents);
        e.target.innerText = "Redirecting...";
        e.target.disabled = true;
        
        try {
            // 1. Ask your backend to generate a secure Stripe payment link
            const res = await fetch(`${httpApiBase}/api/payments/create-checkout-session`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ user_id: USER_ID, amount: amountCents, amountTokens: amountTokens })
            });
            
            const data = await res.json();
            
            if (data.url) {
                // 2. Send the user to the Stripe payment screen
                window.location.href = data.url;
            } else {
                throw new Error("No session checkout URL returned from server.");
            }
            
        } catch (error) {
            console.error("Redirect to checkout failed", error);
            e.target.innerText = "Failed";
            e.target.style.backgroundColor = "var(--danger)";
            e.target.disabled = false;
        }
    });
});


// Load initial balance
fetchBalance();
