# Data View Toggle Feature

## 🎯 **Tính năng mới: Switch toggle giữa Table View và Object View**

### **Thay đổi chính:**

1. **Bỏ button "Show all rows"** - Mặc định hiển thị toàn bộ bản ghi
2. **Thêm Switch toggle** - Chuyển đổi giữa 2 view modes:
   - **Table View**: Hiển thị dữ liệu dạng bảng (như cũ)
   - **Object View**: Hiển thị dữ liệu đã group theo profileName

### **Table View (Default)**
```
| Profile | Content | Tags | Schedule |
|---------|---------|------|----------|
| User A  | Hello   | #tech| 10:00    |
| User A  | World   | #ai  | 11:00    |
| User B  | Test    | #dev | 12:00    |
```

### **Object View (Grouped by Profile)**
```
📋 Profile: User A (2 rows)
┌─────────────────────────────────────┐
│ Content: Hello                      │
│ Tags: #tech                         │
│ Schedule: 10:00                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Content: World                      │
│ Tags: #ai                           │
│ Schedule: 11:00                     │
└─────────────────────────────────────┘

📋 Profile: User B (1 row)
┌─────────────────────────────────────┐
│ Content: Test                       │
│ Tags: #dev                          │
│ Schedule: 12:00                     │
└─────────────────────────────────────┘
```

### **UI Components:**

#### **Switch Toggle**
```tsx
<Switch
  id="view-toggle"
  checked={viewAsObject}
  onCheckedChange={setViewAsObject}
/>
```

#### **Dynamic Labels**
- `Table View` / `Object View` label
- Row count / Profile count indicator

### **Lợi ích:**

1. **User-friendly**: Dễ dàng chuyển đổi giữa 2 view modes
2. **Visual grouping**: Object view giúp user hiểu rõ data được group như thế nào
3. **Flexible headers**: Hoạt động với mọi structure Excel
4. **Real-time preview**: Thấy ngay kết quả mapping với browser profiles

### **Technical Implementation:**

```typescript
// State management
const [viewAsObject, setViewAsObject] = useState(false)

// Group data by profile
const getGroupedData = (csvData: CsvRow[]) => {
  const groups: Record<string, CsvRow[]> = {}
  
  for (const row of csvData) {
    const profileKey = Object.keys(row).find(key => key.toLowerCase() === 'profile')
    if (profileKey) {
      const profileName = (row[profileKey] || '').toString().trim()
      if (profileName) {
        if (!groups[profileName]) groups[profileName] = []
        groups[profileName].push(row)
      }
    }
  }
  
  return groups
}

// Conditional rendering
{viewAsObject ? (
  // Object view with grouped data
  <div>...</div>
) : (
  // Table view with all rows
  <table>...</table>
)}
```

### **User Experience:**

1. **Load Excel file** → Hiển thị Table View (default)
2. **Toggle switch** → Chuyển sang Object View để xem grouped data
3. **Toggle lại** → Quay về Table View
4. **Visual feedback** → Label và count thay đổi theo view mode

**Kết quả:** User có thể dễ dàng hiểu và visualize cách data sẽ được map với browser profiles! 🎉
