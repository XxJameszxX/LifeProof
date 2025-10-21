// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// FHEVM
import {FHE, euint8, euint32, euint64, euint256, ebool, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * LifeProof – 生活事件上链档案 NFT
 *
 * 设计要点：
 * - 文本与元数据 URI 按需求上链（title、description、imageURI、category、timestamp、isPublic）。
 * - “心情分数 moodScore(0-100)” 作为隐私字段，使用 FHE euint8 存储和运算。
 * - 允许用户基于 ACL 解密自己的心情分数；并提供公共加密句柄读取接口。
 */
contract LifeProof is ERC721, Ownable, SepoliaConfig {
    struct LifeEvent {
        string title;
        string description;
        string imageURI;     // IPFS CID
        string category;     // Graduation / Marriage / Travel / ...
        uint256 timestamp;   // unix seconds
        bool isPublic;       // public or private
    }

    uint256 public nextTokenId;

    // tokenId => LifeEvent
    mapping(uint256 => LifeEvent) public lifeEvents;

    // tokenId => encrypted mood score (0..100)
    mapping(uint256 => euint8) private _moodScore;

    // tokenId => owner
    mapping(uint256 => address) private _ownerOfToken;

    // --- Public feed / likes / comments ---
    uint256[] private _publicFeed; // append-only; read-time过滤 isPublic
    mapping(uint256 => bool) private _everPublished; // 防止重复加入 feed

    mapping(uint256 => mapping(address => bool)) private _liked;
    mapping(uint256 => uint256) public likeCounts;

    struct CommentInfo {
        address user;
        string cid; // IPFS CID or short text
        uint256 timestamp;
    }
    mapping(uint256 => CommentInfo[]) private _comments;

    event LifeEventCreated(address indexed user, uint256 indexed tokenId);
    event LifeEventVisibilityChanged(uint256 indexed tokenId, bool isPublic);
    event LifeEventPublished(uint256 indexed tokenId);
    event LifeEventLiked(uint256 indexed tokenId, address indexed user, bool liked, uint256 newCount);
    event LifeEventCommented(uint256 indexed tokenId, address indexed user, string cid);

    constructor() ERC721("LifeProof", "LIFE") Ownable(msg.sender) {}

    /**
     * 铸造一条生活事件，并存储加密的心情分数。
     * - moodExternal: 外部加密输入 (externalEuint8)
     * - proof: Relayer 生成的输入证明
     *
     * 说明：
     * - 内部通过 FHE.fromExternal 转为 euint8。
     * - 设置 ACL：合约自身与调用者可访问（便于后续授权与用户解密）。
     */
    function mintLifeEvent(
        string memory title,
        string memory description,
        string memory imageURI,
        string memory category,
        bool isPublic,
        externalEuint8 moodExternal,
        bytes calldata proof
    ) external returns (uint256 tokenId) {
        tokenId = ++nextTokenId;

        // 1) mint NFT
        _safeMint(msg.sender, tokenId);
        _ownerOfToken[tokenId] = msg.sender;

        // 2) store public metadata
        lifeEvents[tokenId] = LifeEvent({
            title: title,
            description: description,
            imageURI: imageURI,
            category: category,
            timestamp: block.timestamp,
            isPublic: isPublic
        });

        // 3) convert external encrypted mood into internal FHE type
        euint8 mood = FHE.fromExternal(moodExternal, proof);

        // 4) clamp to 0..100 using FHE ops (防御性处理)
        euint8 maxAllowed = FHE.asEuint8(100);
        euint8 zero = FHE.asEuint8(0);
        // min(mood, 100)
        euint8 bounded = FHE.min(mood, maxAllowed);
        // max(bounded, 0) 由于无符号，此步仅示例
        _moodScore[tokenId] = FHE.max(bounded, zero);

        // 5) set ACL for future decryptions
        FHE.allowThis(_moodScore[tokenId]);
        FHE.allow(_moodScore[tokenId], msg.sender);

        // 若事件为公开，则在铸造时直接发布到公共广场（避免前端额外再调用一次可见性切换）
        if (isPublic && !_everPublished[tokenId]) {
            _everPublished[tokenId] = true;
            _publicFeed.push(tokenId);
            emit LifeEventPublished(tokenId);
        }

        emit LifeEventCreated(msg.sender, tokenId);
    }

    function toggleVisibility(uint256 tokenId, bool isPublic) external {
        _requireOwnedBySender(tokenId);
        lifeEvents[tokenId].isPublic = isPublic;
        emit LifeEventVisibilityChanged(tokenId, isPublic);
        if (isPublic && !_everPublished[tokenId]) {
            _everPublished[tokenId] = true;
            _publicFeed.push(tokenId);
            emit LifeEventPublished(tokenId);
        }
    }

    /**
     * 返回调用者的所有 LifeEvent
     * 注意：仅返回元数据；心情分数为加密存储，单独接口提供句柄。
     */
    function getMyEvents() external view returns (LifeEvent[] memory) {
        uint256 balance = balanceOf(msg.sender);
        LifeEvent[] memory result = new LifeEvent[](balance);

        uint256 found;
        uint256 supply = nextTokenId;
        for (uint256 tokenId = 1; tokenId <= supply; tokenId++) {
            if (_ownerOfToken[tokenId] == msg.sender) {
                result[found++] = lifeEvents[tokenId];
                if (found == balance) break;
            }
        }
        return result;
    }

    /**
     * 返回调用者所拥有的 tokenId 列表（与 getMyEvents 返回顺序一致）。
     */
    function getMyEventIds() external view returns (uint256[] memory) {
        uint256 balance = balanceOf(msg.sender);
        uint256[] memory ids = new uint256[](balance);
        uint256 found;
        uint256 supply = nextTokenId;
        for (uint256 tokenId = 1; tokenId <= supply; tokenId++) {
            if (_ownerOfToken[tokenId] == msg.sender) {
                ids[found++] = tokenId;
                if (found == balance) break;
            }
        }
        return ids;
    }

    /**
     * 读取指定 token 的加密心情分数句柄（用于前端解密）。
     * - 只有 NFT 拥有者可读取（隐私字段）。
     */
    function getMoodHandle(uint256 tokenId) external view returns (euint8) {
        _requireOwnedBySender(tokenId);
        return _moodScore[tokenId];
    }

    /**
     * 为指定 token 的心情分数授予临时访问权限（当前交易）。
     * 可用于某些链上计算后再解密的场景。
     */
    function allowTransientMood(uint256 tokenId, address user) external {
        _requireOwnedBySender(tokenId);
        FHE.allowTransient(_moodScore[tokenId], user);
    }

    /**
     * 示例：对心情分数做加法（加 k，k 为明文小整数），并返回新的加密分数。
     * - 使用标量运算以节省 gas。
     */
    function addToMood(uint256 tokenId, uint8 k) external {
        _requireOwnedBySender(tokenId);
        euint8 v = _moodScore[tokenId];
        v = FHE.add(v, k);
        // 再做边界裁剪
        v = FHE.min(v, FHE.asEuint8(100));
        _moodScore[tokenId] = v;
        // 更新 ACL（保证后续仍可解密）
        FHE.allowThis(_moodScore[tokenId]);
        FHE.allow(_moodScore[tokenId], msg.sender);
    }

    function _requireOwnedBySender(uint256 tokenId) internal view {
        require(_ownerOfToken[tokenId] == msg.sender, "Not token owner");
    }

    // ----------------------
    // Public Feed / Likes / Comments
    // ----------------------

    function getEvent(uint256 tokenId) external view returns (LifeEvent memory) {
        return lifeEvents[tokenId];
    }

    function getPublicFeed(uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        uint256 n = _publicFeed.length;
        if (offset >= n) return new uint256[](0);
        uint256 remaining = n - offset;
        uint256 size = remaining < limit ? remaining : limit;
        uint256[] memory out = new uint256[](size);
        // 最新优先：从尾部往前
        for (uint256 i = 0; i < size; i++) {
            uint256 idx = n - 1 - (offset + i);
            uint256 tokenId = _publicFeed[idx];
            if (lifeEvents[tokenId].isPublic) {
                out[i] = tokenId;
            } else {
                out[i] = 0; // 由前端过滤 0
            }
        }
        return out;
    }

    function like(uint256 tokenId, bool doLike) external {
        require(tokenId > 0 && tokenId <= nextTokenId, "Invalid tokenId");
        require(lifeEvents[tokenId].isPublic, "Not public");
        bool cur = _liked[tokenId][msg.sender];
        if (doLike && !cur) {
            _liked[tokenId][msg.sender] = true;
            likeCounts[tokenId] += 1;
            emit LifeEventLiked(tokenId, msg.sender, true, likeCounts[tokenId]);
        } else if (!doLike && cur) {
            _liked[tokenId][msg.sender] = false;
            if (likeCounts[tokenId] > 0) likeCounts[tokenId] -= 1;
            emit LifeEventLiked(tokenId, msg.sender, false, likeCounts[tokenId]);
        }
    }

    function hasLiked(uint256 tokenId, address user) external view returns (bool) {
        return _liked[tokenId][user];
    }

    function addComment(uint256 tokenId, string calldata cid) external {
        require(tokenId > 0 && tokenId <= nextTokenId, "Invalid tokenId");
        require(lifeEvents[tokenId].isPublic, "Not public");
        _comments[tokenId].push(CommentInfo({user: msg.sender, cid: cid, timestamp: block.timestamp}));
        emit LifeEventCommented(tokenId, msg.sender, cid);
    }

    function getComments(uint256 tokenId, uint256 offset, uint256 limit) external view returns (CommentInfo[] memory) {
        CommentInfo[] storage all = _comments[tokenId];
        uint256 n = all.length;
        if (offset >= n) return new CommentInfo[](0);
        uint256 remaining = n - offset;
        uint256 size = remaining < limit ? remaining : limit;
        CommentInfo[] memory out = new CommentInfo[](size);
        for (uint256 i = 0; i < size; i++) {
            out[i] = all[n - 1 - (offset + i)]; // 最新优先
        }
        return out;
    }
}


