
async function debugResend() {
    try {
        console.log("Attempting to import resend...");
        const resendModule = await import('resend');
        console.log("Import successful.");
        console.log("Keys in module:", Object.keys(resendModule));

        if (resendModule.Resend) {
            console.log("Resend class found directly.");
        } else if (resendModule.default && resendModule.default.Resend) {
            console.log("Resend class found in default export.");
        } else {
            console.log("Resend class NOT found.");
            console.log("Module structure:", resendModule);
        }

    } catch (e) {
        console.error("Import failed:", e);
    }
}

debugResend();
