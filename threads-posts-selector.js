// CSS Selector để tìm 10 bài viết trong Threads feed

// 1. Selector chính - tìm tất cả posts
const postsSelector = 'div[data-pressable-container="true"]';

// 2. Selector chi tiết hơn - kết hợp với class pattern
const detailedPostsSelector = 'div.x1ypdohk.x1n2onr6[data-pressable-container="true"]';

// 3. Selector với container wrapper
const postsWithWrapperSelector = 'div.x78zum5.xdt5ytf.x1iyjqo2.x1n2onr6 div[data-pressable-container="true"]';

// Code để lấy 10 bài viết
function getThreadsPosts() {
    // Cách 1: Sử dụng selector đơn giản
    const posts = document.querySelectorAll('div[data-pressable-container="true"]');
    
    // Cách 2: Sử dụng selector chi tiết hơn
    const detailedPosts = document.querySelectorAll('div.x1ypdohk.x1n2onr6[data-pressable-container="true"]');
    
    console.log(`Tìm thấy ${posts.length} bài viết`);
    console.log(`Tìm thấy ${detailedPosts.length} bài viết (detailed)`);
    
    return posts;
}

// Code để đếm posts hiện tại
function countCurrentPosts() {
    const posts = document.querySelectorAll('div[data-pressable-container="true"]');
    return posts.length;
}

// Code để detect khi có posts mới load
function detectNewPosts(previousCount) {
    const currentCount = countCurrentPosts();
    return currentCount > previousCount;
}

// Code để scroll và đợi load thêm posts
async function scrollAndWaitForNewPosts() {
    const initialCount = countCurrentPosts();
    console.log(`Posts ban đầu: ${initialCount}`);
    
    // Scroll xuống
    window.scrollTo(0, document.body.scrollHeight);
    
    // Đợi và kiểm tra posts mới
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Đợi 1 giây
        
        const currentCount = countCurrentPosts();
        console.log(`Posts hiện tại: ${currentCount}`);
        
        if (currentCount > initialCount) {
            console.log(`Đã load thêm ${currentCount - initialCount} posts mới`);
            return currentCount;
        }
        
        attempts++;
    }
    
    console.log('Không có posts mới được load');
    return initialCount;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        postsSelector,
        detailedPostsSelector,
        postsWithWrapperSelector,
        getThreadsPosts,
        countCurrentPosts,
        detectNewPosts,
        scrollAndWaitForNewPosts
    };
}
