# Raw Object View for Dev Mapping

## 🎯 **Tính năng mới: Raw Object View với Copy to Clipboard**

### **Mục đích:**
Giúp dev dễ dàng copy raw object structure để sử dụng trong automation scripts của họ.

### **Object View hiển thị:**

#### **1. Header với Copy Button**
```
📋 Raw Object Data (for dev mapping)
Copy this object structure to use in your automation scripts    [Copy]
```

#### **2. Raw JSON Object (Console.log style)**
```json
{
  "Profile A": [
    {
      "profile": "Profile A",
      "content": "Hello world",
      "tags": "#threads #automation",
      "media": "/path/image1.jpg",
      "schedule": "2024-01-01 10:00"
    },
    {
      "profile": "Profile A", 
      "content": "Second post",
      "tags": "#tech #ai",
      "media": "/path/image2.jpg",
      "schedule": "2024-01-01 11:00"
    }
  ],
  "Profile B": [
    {
      "profile": "Profile B",
      "content": "Different content", 
      "tags": "#marketing",
      "media": "/path/image3.jpg",
      "schedule": "2024-01-01 12:00"
    }
  ]
}
```

#### **3. Usage Example**
```javascript
// Example usage:
const profileData = {
  "Profile A": [
    {
      "profile": "Profile A",
      "content": "Hello world",
      "tags": "#threads #automation", 
      "media": "/path/image1.jpg",
      "schedule": "2024-01-01 10:00"
    }
  ]
};

// Access data for specific profile:
const userAData = profileData["Profile A"];
console.log(userAData); // Array of rows for Profile A
```

### **Features:**

#### **1. Copy to Clipboard**
- Button "Copy" với icon
- Copy toàn bộ raw JSON object
- Console log confirmation

#### **2. Syntax Highlighting**
- Dark background (terminal style)
- Green text (console.log style)
- Monospace font for readability

#### **3. Dev-Friendly Format**
- Pretty-printed JSON (2 spaces indent)
- Exact structure như `console.log()`
- Ready to paste vào script

### **User Workflow:**

1. **Load Excel file** → Data được parse
2. **Toggle to Object View** → Hiển thị raw object structure
3. **Click Copy button** → Raw object copied to clipboard
4. **Paste vào automation script** → Sử dụng ngay

### **Technical Implementation:**

```typescript
// Copy function
const handleCopyToClipboard = async (data: any) => {
  try {
    const jsonString = JSON.stringify(data, null, 2)
    await navigator.clipboard.writeText(jsonString)
    console.log('Raw object copied to clipboard!')
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
  }
}

// UI Component
<Button
  variant="outline"
  size="sm"
  onClick={() => handleCopyToClipboard(groupedData)}
  className="h-7 px-2 text-xs"
  title="Copy raw object to clipboard"
>
  <Copy className="h-3 w-3 mr-1" />
  Copy
</Button>

// Display raw JSON
<div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-auto">
  <pre>{JSON.stringify(groupedData, null, 2)}</pre>
</div>
```

### **Lợi ích cho Dev:**

1. **Easy Copy-Paste**: Không cần manual copy từ console
2. **Exact Structure**: Giống hệt như `console.log()` output
3. **Ready to Use**: Paste trực tiếp vào automation script
4. **Visual Confirmation**: Thấy rõ structure trước khi copy
5. **Error Prevention**: Tránh typo khi manual typing

### **Example Usage trong Automation Script:**

```javascript
// Paste từ clipboard vào automation script
const profileData = {
  "Profile A": [
    {
      "profile": "Profile A",
      "content": "Hello world",
      "tags": "#threads #automation",
      "media": "/path/image1.jpg", 
      "schedule": "2024-01-01 10:00"
    }
  ],
  "Profile B": [
    {
      "profile": "Profile B",
      "content": "Different content",
      "tags": "#marketing", 
      "media": "/path/image3.jpg",
      "schedule": "2024-01-01 12:00"
    }
  ]
};

// Sử dụng trong automation
for (const [profileName, rows] of Object.entries(profileData)) {
  console.log(`Processing ${profileName} with ${rows.length} posts`);
  
  for (const row of rows) {
    await postToThreads({
      content: row.content,
      tags: row.tags,
      media: row.media,
      schedule: row.schedule
    });
  }
}
```

**Kết quả:** Dev có thể dễ dàng copy raw object structure và sử dụng ngay trong automation scripts! 🚀
