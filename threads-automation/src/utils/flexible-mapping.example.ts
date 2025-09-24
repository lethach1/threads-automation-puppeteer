/**
 * Example: Flexible Excel to Browser Profile Mapping
 * 
 * Với hệ thống flexible mới, user có thể tạo Excel với structure bất kỳ
 * và system sẽ tự động map với browser profiles
 */

// Example 1: User tạo Excel với structure tùy ý
const exampleExcelData = [
  { profile: "Profile A", content: "Hello world", hashtags: "#threads #automation", media: "/path/image1.jpg", schedule: "2024-01-01 10:00" },
  { profile: "Profile A", content: "Second post", hashtags: "#tech #ai", media: "/path/image2.jpg", schedule: "2024-01-01 11:00" },
  { profile: "Profile B", content: "Different content", hashtags: "#marketing", media: "/path/image3.jpg", schedule: "2024-01-01 12:00" }
]

// Example 2: Browser profiles từ API
const browserProfiles = [
  { id: "profile-123", name: "Profile A", location: "/profiles/profile-123" },
  { id: "profile-456", name: "Profile B", location: "/profiles/profile-456" }
]

// Example 3: Mapping process (tự động trong ProfileTable.tsx)
const mappingProcess = () => {
  // 1. Group Excel data by profile name
  const groups = {
    "Profile A": [
      { profile: "Profile A", content: "Hello world", hashtags: "#threads #automation", media: "/path/image1.jpg", schedule: "2024-01-01 10:00" },
      { profile: "Profile A", content: "Second post", hashtags: "#tech #ai", media: "/path/image2.jpg", schedule: "2024-01-01 11:00" }
    ],
    "Profile B": [
      { profile: "Profile B", content: "Different content", hashtags: "#marketing", media: "/path/image3.jpg", schedule: "2024-01-01 12:00" }
    ]
  }

  // 2. Map profile names to browser profile IDs
  const nameToId = {
    "Profile A": "profile-123",
    "Profile B": "profile-456"
  }

  // 3. Create dynamic data structure (không hard-code columns)
  const inputByProfileId = new Map([
    [
      "profile-123", // Browser profile ID
      {
        // Dynamic data từ Excel (tất cả columns trừ 'profile')
        content: "Hello world",
        hashtags: "#threads #automation", 
        media: "/path/image1.jpg",
        schedule: "2024-01-01 10:00",
        items: [
          { content: "Hello world", hashtags: "#threads #automation", media: "/path/image1.jpg", schedule: "2024-01-01 10:00" },
          { content: "Second post", hashtags: "#tech #ai", media: "/path/image2.jpg", schedule: "2024-01-01 11:00" }
        ]
      }
    ],
    [
      "profile-456",
      {
        content: "Different content",
        hashtags: "#marketing",
        media: "/path/image3.jpg", 
        schedule: "2024-01-01 12:00",
        items: [
          { content: "Different content", hashtags: "#marketing", media: "/path/image3.jpg", schedule: "2024-01-01 12:00" }
        ]
      }
    ]
  ])

  return inputByProfileId
}

// Example 4: User có thể tạo Excel với structure khác hoàn toàn
const alternativeExcelData = [
  { ProfileName: "User1", PostContent: "My post", Tags: "#social", ImagePath: "/images/1.jpg", PostTime: "09:00" },
  { ProfileName: "User2", PostContent: "Another post", Tags: "#tech", ImagePath: "/images/2.jpg", PostTime: "10:00" }
]

// System sẽ tự động:
// 1. Tìm column "ProfileName" (case-insensitive matching với "profile")
// 2. Lấy tất cả columns khác: PostContent, Tags, ImagePath, PostTime
// 3. Map với browser profiles
// 4. Tạo dynamic structure

export const examples = {
  mappingProcess,
  exampleExcelData,
  alternativeExcelData,
  browserProfiles
}

/**
 * Lợi ích của hệ thống flexible:
 * 
 * 1. User tự do tạo Excel với structure bất kỳ
 * 2. Chỉ cần có 1 column "profile" (case-insensitive) để group data
 * 3. Tất cả columns khác được preserve và pass qua automation
 * 4. Không bị giới hạn bởi hard-coded column names
 * 5. Dễ dàng extend cho các use case mới
 */
