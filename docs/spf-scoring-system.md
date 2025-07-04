# SPF Scoring System

The SPF scoring system evaluates SPF records based on best practices and RFC compliance, providing a comprehensive score out of 37 points with letter grades.

## Scoring Breakdown

### 1. SPF Record Present (10 points)
- **Description**: SPF TXT record exists on the domain (with correct v=spf1). If missing, domain is unprotected by SPF.
- **Scoring**: 10 points if present, 0 if missing
- **Example**: `v=spf1 ip4:192.168.1.1 -all` → 10 points

### 2. Single SPF Record (5 points)
- **Description**: Only one SPF record is published (no duplicates). Multiple records cause SPF failure.
- **Scoring**: 5 points if single, 0 if multiple
- **Example**: One SPF record → 5 points, Multiple SPF records → 0 points

### 3. SPF Syntax Valid (5 points)
- **Description**: SPF record is syntactically correct (no obvious errors, unrecognized mechanisms, or syntax violations).
- **Scoring**: 5 points if parser succeeds, 0 if syntax errors
- **Example**: `v=spf1 ip4:192.168.1.1 -all` → 5 points, `v=spf1 invalid-mechanism -all` → 0 points

### 4. Authorized Sources ≤ 10 Lookups (5 points)
- **Description**: SPF includes/redirects do not exceed 10 DNS lookups. (Staying within RFC limit avoids permerror.)
- **Scoring**: 5 points if ≤10, 0 if >10
- **Example**: 8 DNS lookups → 5 points, 12 DNS lookups → 0 points

### 5. No "Pass All" Mechanism (5 points)
- **Description**: SPF does not use +all which would allow any sender.
- **Scoring**: 5 points if no +all, 0 if present
- **Example**: `v=spf1 ip4:192.168.1.1 -all` → 5 points, `v=spf1 ip4:192.168.1.1 +all` → 0 points

### 6. All Mechanism Policy (5 points)
- **Description**: SPF uses an appropriate policy on "all":
  - `-all` (hard fail) configured: 5 points (strict enforcement)
  - `~all` (soft fail): 3 points (partial credit, more relaxed)
  - `?all` or no all: 0 (neutral or missing policy is poor)
- **Scoring**: Up to 5 points based on policy
- **Examples**:
  - `v=spf1 ip4:192.168.1.1 -all` → 5 points
  - `v=spf1 ip4:192.168.1.1 ~all` → 3 points
  - `v=spf1 ip4:192.168.1.1 ?all` → 0 points
  - `v=spf1 ip4:192.168.1.1` (no all) → 0 points

### 7. No Deprecated Mechanisms (2 points)
- **Description**: SPF record does not use deprecated mechanisms like ptr. (If none, give 2 points; if present, 0.)
- **Scoring**: 2 points if none, 0 if present
- **Example**: `v=spf1 ip4:192.168.1.1 -all` → 2 points, `v=spf1 ptr:example.com -all` → 0 points

## Grade Calculation

Based on the percentage score:
- **A**: 90-100% (33-37 points)
- **B**: 80-89% (30-32 points)
- **C**: 70-79% (26-29 points)
- **D**: 60-69% (22-25 points)
- **F**: 0-59% (0-21 points)

## Example Scores

### Perfect SPF Record (37/37 points - Grade A)
```
v=spf1 ip4:192.168.1.1 -all
```
- ✅ SPF Record Present: 10 points
- ✅ Single SPF Record: 5 points
- ✅ SPF Syntax Valid: 5 points
- ✅ Authorized Sources ≤ 10: 5 points
- ✅ No "Pass All": 5 points
- ✅ All Mechanism Policy (-all): 5 points
- ✅ No Deprecated Mechanisms: 2 points
- **Total: 37/37 (100%) - Grade A**

### Good SPF Record (35/37 points - Grade A)
```
v=spf1 ip4:192.168.1.1 ~all
```
- ✅ SPF Record Present: 10 points
- ✅ Single SPF Record: 5 points
- ✅ SPF Syntax Valid: 5 points
- ✅ Authorized Sources ≤ 10: 5 points
- ✅ No "Pass All": 5 points
- ⚠️ All Mechanism Policy (~all): 3 points
- ✅ No Deprecated Mechanisms: 2 points
- **Total: 35/37 (95%) - Grade A**

### Poor SPF Record (27/37 points - Grade C)
```
v=spf1 ip4:192.168.1.1 +all
```
- ✅ SPF Record Present: 10 points
- ✅ Single SPF Record: 5 points
- ✅ SPF Syntax Valid: 5 points
- ✅ Authorized Sources ≤ 10: 5 points
- ❌ No "Pass All": 0 points
- ❌ All Mechanism Policy (+all): 0 points
- ✅ No Deprecated Mechanisms: 2 points
- **Total: 27/37 (73%) - Grade C**

### No SPF Record (0/37 points - Grade F)
```
No SPF record found
```
- ❌ SPF Record Present: 0 points
- ❌ Single SPF Record: 0 points
- ❌ SPF Syntax Valid: 0 points
- ❌ Authorized Sources ≤ 10: 0 points
- ❌ No "Pass All": 0 points
- ❌ All Mechanism Policy: 0 points
- ❌ No Deprecated Mechanisms: 0 points
- **Total: 0/37 (0%) - Grade F**

## API Response Format

The scoring results are included in the API response:

```json
{
  "domain": "example.com",
  "spfRecords": [...],
  "validationResults": {...},
  "scoringResults": {
    "totalScore": 35,
    "maxPossibleScore": 37,
    "percentage": 95,
    "grade": "A",
    "scoreItems": [
      {
        "name": "SPF Record Present",
        "description": "SPF TXT record exists on the domain...",
        "score": 10,
        "maxScore": 10,
        "passed": true,
        "details": "SPF record found"
      },
      // ... more score items
    ]
  }
}
```

## Best Practices

To achieve a high score:

1. **Always include an SPF record** - This is the most critical factor
2. **Use hard fail (-all)** - Provides the strongest protection
3. **Keep DNS lookups under 10** - Avoids permerror responses
4. **Avoid deprecated mechanisms** - Don't use `ptr` mechanism
5. **Never use +all** - This allows any sender and defeats the purpose
6. **Ensure proper syntax** - Validate your SPF record format
7. **Use only one SPF record** - Multiple records cause failures

## Implementation Details

The scoring system is implemented in the `SpfScorer` class and integrates with the existing SPF validation system. It provides detailed feedback for each scoring criterion, helping users understand exactly why they received their score and how to improve it. 