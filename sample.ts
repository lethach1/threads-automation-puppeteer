// Custom Automation Logic - Sample Script
// Just write your automation steps here - all functions and modules are available

// Step 1: Navigate to Threads
await page.goto('https://threads.com/', { waitUntil: 'networkidle2' })
await humanDelay(2000, 4000)

// Step 2: Open composer
await waitForElements(page, '.x1i10hfl > .xc26acl')
await humanClick(page, '.x1i10hfl > .xc26acl')

// Step 3: Type post text
if (input.postText) {
  await waitForElements(page, '.xzsf02u > .xdj266r')
  await humanClick(page, '.xzsf02u > .xdj266r')
  console.log('⌨️ Typing post text:', input.postText)
  await humanTypeWithMistakes(page, '.xzsf02u > .xdj266r', input.postText)
}

// Step 4: Upload media if provided
if (input.mediaPath && fs.existsSync(input.mediaPath)) {
  try {
    const stat = fs.statSync(input.mediaPath)
    if (stat.isFile()) {
      console.log('📷 Uploading image:', input.mediaPath)
      
      // Try to find file input
      let fileInput = await page.$('input[type="file"]')
      if (!fileInput) {
        // Click add media button
        await humanClick(page, '.x6s0dn4 > .x1i10hfl:nth-child(1) > .x1n2onr6 > .x1lliihq')
        await humanDelay(500, 1000)
        fileInput = await page.$('input[type="file"]')
      }
      
      if (fileInput) {
        await fileInput.uploadFile(input.mediaPath)
        await humanDelay(1500, 2500)
      }
    }
  } catch (e) {
    console.log('🟨 Media upload failed:', e.message)
  }
}

// Step 5: Add topic/tag if provided
if (input.tag) {
  await waitForElements(page, 'input.xwhw2v2')
  await humanClick(page, 'input.xwhw2v2')
  await humanTypeWithMistakes(page, 'input.xwhw2v2', input.tag)
}

// Step 6: Post content
await waitForElements(page, '.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
await humanClick(page, '.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
await humanDelay(2000, 4000)

console.log('✅ Post created successfully!')

// Step 7: Navigate to profile to add comments
await waitForElements(page, '.x78zum5 > .x1i10hfl > .x90nhty > .xl1xv1r')
await humanClick(page, '.x78zum5 > .x1i10hfl > .x90nhty > .xl1xv1r')
await humanDelay(1000, 2000)

// Step 8: Click on the post to open it
await waitForElements(page, '.x1c1b4dv:nth-child(7) .x78zum5:nth-child(1) > .x9f619:nth-child(1) .x1xdureb:nth-child(3) .x6s0dn4:nth-child(2) .x1lliihq:nth-child(1)')
await humanClick(page, '.x1c1b4dv:nth-child(7) .x78zum5:nth-child(1) > .x9f619:nth-child(1) .x1xdureb:nth-child(3) .x6s0dn4:nth-child(2) .x1lliihq:nth-child(1)')
await humanDelay(1000, 2000)

// Step 9: Add comments if provided
if (input.commentText) {
  const comments = input.commentText.split('|').map(c => c.trim()).filter(Boolean)
  
  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i]
    console.log(`🗨️ Adding comment ${i + 1}/${comments.length}:`, comment.slice(0, 50))
    
    // Type comment
    await waitForElements(page, '.xzsf02u > .xdj266r')
    await humanClick(page, '.xzsf02u > .xdj266r')
    await humanTypeWithMistakes(page, '.xzsf02u > .xdj266r', comment)
    
    // Post comment
    await waitForElements(page, '.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
    await humanClick(page, '.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
    await humanDelay(2000, 3000)
    
    // Delay between comments
    if (i < comments.length - 1) {
      await humanDelay(3000, 5000)
    }
  }
}

console.log('🎉 All automation steps completed successfully!')

// Available functions:
// - humanDelay(min, max): Random delay between min and max milliseconds
// - humanClick(page, selector): Human-like click with random delay
// - humanTypeWithMistakes(page, selector, text): Type text with human-like mistakes
// - waitForElements(page, selector): Wait for elements to appear
// - console.log(): For debugging

// Available modules:
// - fs: File system operations (existsSync, readFileSync, etc.)
// - path: Path utilities (join, dirname, etc.)

// Input object contains:
// - input.postText: Text to post
// - input.commentText: Comments to add (separated by |)
// - input.mediaPath: Path to image file
// - input.tag: Topic/tag to add


const writingPost(page,text, index) => {
  const elements = await page.$$('div[role="textbox"] > p > span');  
  if (elements.length > index) {
    const element = elements[index];
    await humanClick(page,'div[role="textbox"]>p>span')
    await humanTypeWithMistakes(page, 'div[role="textbox"]>p>span', text)
}
