
const GITHUB_API_BASE = 'https://api.github.com';

export interface GithubConfig {
    token: string;
    owner: string;
    repo: string;
    branch?: string; // default to main
    path?: string;   // default to 'releases'
}

// Helper: Convert File to Base64 (strip header)
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove "data:*/*;base64," prefix
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
};

export const uploadToGithub = async (file: File, config: GithubConfig): Promise<string> => {
    const { token, owner, repo, branch = 'main', path = 'releases' } = config;
    
    // 1. Prepare file content
    const content = await fileToBase64(file);
    const timestamp = new Date().getTime();
    // Sanitize filename: replace spaces with underscores, keep extension
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${path}/${timestamp}_${safeName}`;
    
    // 2. Upload to GitHub via API
    // PUT /repos/{owner}/{repo}/contents/{path}
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${filePath}`;
    
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
            message: `Upload ${file.name} via Weight Loss Dashboard Admin`,
            content: content,
            branch: branch
        })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`GitHub Upload Failed: ${err.message}`);
    }

    // 3. Construct CDN URL (jsDelivr) for fast download in China
    // Format: https://cdn.jsdelivr.net/gh/{user}/{repo}@{version}/{file}
    // We use the branch name as version for simplicity, or raw commit hash if needed.
    // Note: jsDelivr caches heavily. For immediate update, purge might be needed, but for version releases it's fine.
    const cdnUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${filePath}`;
    
    return cdnUrl;
};

// Helper to save/load config from localStorage
export const getGithubConfig = (): GithubConfig | null => {
    const str = localStorage.getItem('github_upload_config');
    return str ? JSON.parse(str) : null;
};

export const saveGithubConfig = (config: GithubConfig) => {
    localStorage.setItem('github_upload_config', JSON.stringify(config));
};
