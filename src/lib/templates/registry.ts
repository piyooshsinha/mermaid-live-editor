/**
 * Curated starting points for common workflows.
 *
 * `@mermaid-js/examples` already ships one canonical sample per diagram *type*,
 * which answers "what does a sequence diagram look like?". These answer a
 * different question — "how do I diagram the thing I actually have?" — so they
 * are organised by task (architecture, org chart, CI pipeline) rather than by
 * Mermaid syntax, and are substantial enough to edit rather than retype.
 */

export interface Template {
  category: TemplateCategory;
  code: string;
  description: string;
  id: string;
  name: string;
}

export type TemplateCategory = 'Architecture' | 'Business' | 'Engineering' | 'Planning';

export const templates: readonly Template[] = [
  {
    category: 'Architecture',
    code: `flowchart TB
    subgraph client["Client"]
        Web["Web App"]
        Mobile["Mobile App"]
    end

    subgraph edge["Edge"]
        CDN["CDN"]
        GW["API Gateway"]
    end

    subgraph services["Services"]
        Auth["Auth Service"]
        Core["Core API"]
        Worker["Background Workers"]
    end

    subgraph data["Data"]
        DB[("Primary DB")]
        Cache[("Cache")]
        Queue[["Message Queue"]]
    end

    Web --> CDN
    Mobile --> GW
    CDN --> GW
    GW --> Auth
    GW --> Core
    Core --> DB
    Core --> Cache
    Core --> Queue
    Queue --> Worker
    Worker --> DB`,
    description: 'Tiered system architecture with client, edge, services, and data layers.',
    id: 'system-architecture',
    name: 'System architecture'
  },
  {
    category: 'Architecture',
    code: `flowchart LR
    Internet(("Internet"))

    subgraph dmz["DMZ - 10.0.1.0/24"]
        LB["Load Balancer"]
        WAF["Firewall / WAF"]
    end

    subgraph private["Private - 10.0.2.0/24"]
        App1["App Server 1"]
        App2["App Server 2"]
    end

    subgraph secure["Restricted - 10.0.3.0/24"]
        DB[("Database")]
    end

    Internet --> WAF
    WAF --> LB
    LB --> App1
    LB --> App2
    App1 --> DB
    App2 --> DB`,
    description: 'Network topology with segmented subnets and traffic flow.',
    id: 'network-diagram',
    name: 'Network diagram'
  },
  {
    category: 'Engineering',
    code: `sequenceDiagram
    autonumber
    participant U as User
    participant C as Client
    participant A as Auth Service
    participant R as Resource API

    U->>C: Enter credentials
    C->>A: POST /login
    A->>A: Verify password hash
    alt Credentials valid
        A-->>C: Access + refresh token
        C->>R: GET /data (Bearer token)
        R->>A: Validate token
        A-->>R: Token claims
        R-->>C: Protected data
        C-->>U: Show dashboard
    else Credentials invalid
        A-->>C: 401 Unauthorized
        C-->>U: Show error
    end`,
    description: 'Login flow with token issue, validation, and the failure branch.',
    id: 'auth-sequence',
    name: 'Authentication flow'
  },
  {
    category: 'Engineering',
    code: `flowchart LR
    Commit["Push to branch"] --> Lint["Lint"]
    Lint --> Test["Unit tests"]
    Test --> Build["Build"]
    Build --> Scan["Security scan"]
    Scan --> Gate{"All checks<br/>passed?"}
    Gate -->|No| Fail["Block merge"]
    Gate -->|Yes| Staging["Deploy to staging"]
    Staging --> E2E["E2E tests"]
    E2E --> Approve{"Manual<br/>approval"}
    Approve -->|Rejected| Fail
    Approve -->|Approved| Prod["Deploy to production"]
    Prod --> Monitor["Monitor and alert"]`,
    description: 'CI/CD stages from commit through production with approval gates.',
    id: 'ci-pipeline',
    name: 'CI/CD pipeline'
  },
  {
    category: 'Engineering',
    code: `classDiagram
    class Order {
        +String id
        +OrderStatus status
        +Money total
        +addItem(item)
        +submit()
    }
    class LineItem {
        +String sku
        +int quantity
        +Money price
    }
    class Customer {
        +String id
        +String email
    }
    class Payment {
        <<interface>>
        +authorize(amount)
        +capture()
    }
    class CardPayment
    class BankTransfer

    Customer "1" --> "*" Order : places
    Order "1" *-- "1..*" LineItem : contains
    Order --> Payment : settled by
    Payment <|.. CardPayment
    Payment <|.. BankTransfer`,
    description: 'UML class diagram with composition, interfaces, and multiplicity.',
    id: 'domain-model',
    name: 'Domain model (UML)'
  },
  {
    category: 'Engineering',
    code: `stateDiagram-v2
    [*] --> Draft
    Draft --> InReview : submit
    InReview --> Draft : request changes
    InReview --> Approved : approve
    Approved --> Published : publish
    Published --> Archived : archive
    Archived --> [*]

    note right of InReview
        Requires two approvals
    end note`,
    description: 'Lifecycle state machine with transitions and terminal states.',
    id: 'state-machine',
    name: 'State machine'
  },
  {
    category: 'Business',
    code: `flowchart TD
    CEO["Chief Executive Officer"]
    CTO["CTO"]
    CFO["CFO"]
    COO["COO"]

    Eng["VP Engineering"]
    Data["Head of Data"]
    Fin["Finance Manager"]
    Ops["Operations Manager"]

    Platform["Platform Team"]
    Product["Product Team"]

    CEO --> CTO
    CEO --> CFO
    CEO --> COO
    CTO --> Eng
    CTO --> Data
    CFO --> Fin
    COO --> Ops
    Eng --> Platform
    Eng --> Product`,
    description: 'Reporting hierarchy from executives down to teams.',
    id: 'org-chart',
    name: 'Org chart'
  },
  {
    category: 'Business',
    code: `flowchart TD
    Start(["Ticket received"]) --> Triage["Triage and categorise"]
    Triage --> Sev{"Severity?"}
    Sev -->|"P1 - Critical"| Page["Page on-call"]
    Sev -->|"P2 - High"| Assign["Assign to team"]
    Sev -->|"P3 - Low"| Backlog["Add to backlog"]
    Page --> Fix["Investigate and fix"]
    Assign --> Fix
    Fix --> Verify{"Verified?"}
    Verify -->|No| Fix
    Verify -->|Yes| Close(["Close ticket"])
    Backlog --> Close`,
    description: 'Support triage process with severity branches and a rework loop.',
    id: 'support-process',
    name: 'Support triage'
  },
  {
    category: 'Planning',
    code: `gantt
    title Product Launch Plan
    dateFormat YYYY-MM-DD
    axisFormat %b %d

    section Discovery
    User research        :done,    res,  2026-01-05, 14d
    Requirements         :done,    req,  after res, 7d

    section Build
    Design system        :active,  des,  after req, 10d
    Core implementation  :         impl, after des, 21d
    Integrations         :         int,  after des, 14d

    section Launch
    QA and hardening     :         qa,   after impl, 10d
    Beta release         :milestone, after qa, 0d
    General availability :milestone, after qa, 7d`,
    description: 'Project timeline with phases, dependencies, and milestones.',
    id: 'project-gantt',
    name: 'Project timeline'
  },
  {
    category: 'Planning',
    code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "ordered as"
    CUSTOMER ||--o| ADDRESS : "ships to"

    CUSTOMER {
        string id PK
        string email UK
        string name
    }
    ORDER {
        string id PK
        string customerId FK
        datetime placedAt
        string status
    }
    LINE_ITEM {
        string orderId FK
        string productId FK
        int quantity
    }
    PRODUCT {
        string id PK
        string sku UK
        decimal price
    }`,
    description: 'Entity relationships with keys and cardinality.',
    id: 'er-diagram',
    name: 'Database schema'
  }
];

export const templateCategories: readonly TemplateCategory[] = [
  'Architecture',
  'Engineering',
  'Business',
  'Planning'
];

export const templatesByCategory = (category: TemplateCategory): Template[] =>
  templates.filter((template) => template.category === category);
