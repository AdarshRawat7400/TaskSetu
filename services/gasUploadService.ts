
export const gasUploadService = {
    async uploadFile(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                try {
                    const base64 = (reader.result as string).split(',')[1];
                    const payload = {
                        base64: base64,
                        type: file.type,
                        name: file.name
                    };

                    const scriptUrl = import.meta.env.VITE_GAS_UPLOAD_URL;

                    if (!scriptUrl) {
                        reject(new Error("Google Apps Script URL is missing in .env.local"));
                        return;
                    }

                    // We use 'no-cors' mode? No, GAS web apps support CORS if deployed correctly.
                    // However, GAS redirects (302) often cause CORS issues with fetch if not handled carefully,
                    // but modern browsers usually handle the redirect for simple GETs. POSTs are trickier.
                    // Standard pattern for GAS POST from client is using `fetch` with `method: "POST"`.
                    // We must send data as stringified JSON in the body.
                    // Note: Google Apps Script POST requests often do not correctly return CORS headers on the *redirect* response in failure cases.
                    // But for success cases with ContentService it usually works.
                    // A safer alternative if CORS fails is to use a hidden iframe or form, but let's try fetch first.

                    // Actually, standard fetch to GAS Web App requires `mode: 'no-cors'` if we don't control the server fully, 
                    // BUT `no-cors` means we can't read the response. 
                    // Wait, GAS *does* support CORS now if we use `ContentService.createTextOutput().setMimeType(...)`.
                    // The script I provided uses exactly that. So standard fetch *should* work and allow reading the response.

                    // Using "text/plain" content-type prevents preflight OPTIONS request which GAS doesn't handle well.
                    const response = await fetch(scriptUrl, {
                        method: "POST",
                        body: JSON.stringify({
                            file: base64,
                            filename: file.name,
                            mimeType: file.type
                        })
                    });

                    const result = await response.json();

                    if (result.status === 'success') {
                        // Construct a direct link for <img> tags to work (viewLink is an HTML page)
                        // Using 'uc' (User Content) export=view is the standard way to get a raw image buffer
                        const directLink = `https://drive.google.com/thumbnail?id=${result.id}&sz=w1000`;
                        resolve(directLink);
                    } else {
                        reject(new Error(result.message || 'Upload failed'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
        });
    },

    async deleteFile(fileUrl: string): Promise<boolean> {
        const scriptUrl = import.meta.env.VITE_GAS_UPLOAD_URL;
        if (!scriptUrl) return false;

        // Extract ID from URL
        let fileId = '';
        if (fileUrl.includes('id=')) {
            fileId = fileUrl.split('id=')[1].split('&')[0];
        } else if (fileUrl.includes('/d/')) {
            fileId = fileUrl.split('/d/')[1].split('/')[0];
        }

        if (!fileId) {
            console.warn("Could not extract file ID for deletion:", fileUrl);
            return false;
        }

        try {
            const response = await fetch(scriptUrl, {
                method: "POST",
                body: JSON.stringify({
                    action: 'delete',
                    fileId: fileId
                })
            });
            const result = await response.json();
            return result.status === 'success';
        } catch (e) {
            console.error("Failed to delete file from Drive:", e);
            return false;
        }
    }
};
